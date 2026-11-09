import 'server-only';
import { z } from 'zod';
import type {
  AppLocale,
  Json,
  MatchmakerMessage,
  MatchmakerStatus,
  MatchmakerStructured,
  MatchmakerThreadSummary,
  ProfileCard,
  SearchFilters,
} from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { isEnabled } from '@/server/config';
import { consumeDailyQuota, getDailyUsage, getPlanState } from '@/server/entitlements';
import { errors } from '@/server/http';
import { scoreCandidates } from '@/server/matching/service';
import { loadBundle, loadBundles, type ProfileBundle } from '@/server/profiles/load';
import { buildViewerContext, compatibilitySummary, toCards } from '@/server/profiles/projection';
import { searchProfiles } from '@/server/search/service';
import { aiAvailable, runStructured, untrusted } from '../client';
import { registerPrompt } from '../prompts';
import { cleanList, hasConsent, isSafeCopy, safeList } from './common';
import { AiFiltersSchema, FILTER_GUIDE, sanitizeFilters } from './filters';
import { parseSmartQuery, removedFiltersNotice, stripAdvancedFilters, summarise } from './smart-search-rules';

export const QUOTA_KEY = 'ai_matchmaker';
const RESULT_LIMIT = 6;
const HISTORY_TURNS = 12;

const LOCALE_NAMES: Record<AppLocale, string> = { en: 'English', ta: 'Tamil', kn: 'Kannada', te: 'Telugu', ml: 'Malayalam', hi: 'Hindi' };

registerPrompt(
  'matchmaker_chat',
  `You are the member's personal matchmaking assistant inside 2K Marriage. You help them describe who they are looking for, ask a few thoughtful clarifying questions, and translate their wishes into search filters. You never contact anyone, never speak for the member, and never message other members.

Each turn you receive the member's own stated partner preferences (<my_preferences>), the filters currently applied (<current_filters>), the recent conversation (<conversation>) and their new message (<member_input>).

Decide an intent:
- "clarify": important details are missing or ambiguous — ask 1-2 short questions.
- "search": the member described what they want — produce filters and say you are looking.
- "refine": the member is adjusting the current search — return the FULL updated filter set (start from current filters and apply their change).
- "chat": general questions about how matchmaking works, or anything that does not need a search.

${FILTER_GUIDE}

Reply rules: warm, concise (max 90 words), no lists longer than 3 items, no promises about outcomes, never describe specific members (results are shown separately by the app). If the member asks to filter on something discriminatory or not member-declared (e.g. skin colour, caste inferred from names), gently explain you can only use preferences people share about themselves, and continue with allowed fields. Write "reply" in the requested language; keep filter values canonical English.
Also return "title": a 3-6 word title for this conversation.`,
);

const TurnSchema = z.object({
  reply: z.string(),
  intent: z.enum(['clarify', 'search', 'refine', 'chat']),
  filters: AiFiltersSchema,
  softPreferences: z.array(z.string()),
  clarifyingQuestions: z.array(z.string()),
  title: z.string(),
});

export async function matchmakerStatus(auth: AuthContext): Promise<MatchmakerStatus> {
  const [plan, used, ai, consent, voice] = await Promise.all([
    getPlanState(auth.userId),
    getDailyUsage(auth.userId, QUOTA_KEY),
    aiAvailable('matchmaker_chat'),
    hasConsent(auth.userId, 'ai_processing'),
    isEnabled('voice_input'),
  ]);
  const limit = plan.entitlements.ai_matchmaker_messages_per_day;
  return { aiAvailable: ai, consentGranted: consent, remainingToday: Math.max(0, limit - used), dailyLimit: limit, voiceInput: voice };
}

export async function listThreads(auth: AuthContext): Promise<MatchmakerThreadSummary[]> {
  const { data } = await db()
    .from('ai_threads')
    .select('id, title, updated_at')
    .eq('user_id', auth.userId)
    .eq('kind', 'matchmaker')
    .order('updated_at', { ascending: false })
    .limit(30);
  return (data ?? []).map((t) => ({ id: t.id, title: t.title, updatedAt: t.updated_at }));
}

async function ownThread(auth: AuthContext, threadId: string) {
  const { data } = await db().from('ai_threads').select('*').eq('id', threadId).eq('user_id', auth.userId).eq('kind', 'matchmaker').maybeSingle();
  if (!data) throw errors.notFound('Conversation not found.');
  return data;
}

async function cardsFor(viewer: ProfileBundle, ids: string[]): Promise<Map<string, ProfileCard>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const bundles = await loadBundles(unique);
  const scored = await scoreCandidates(viewer, [...bundles.values()]);
  const ctx = await buildViewerContext(viewer.profile.id, unique);
  const extras = new Map(unique.flatMap((id) => {
    const p = scored.get(id);
    return p ? [[id, { compatibility: compatibilitySummary(p.mutual, p.confidence), sharedInterests: p.sharedInterests }] as const] : [];
  }));
  const cards = await toCards(unique.flatMap((id) => (bundles.get(id) ? [bundles.get(id)!] : [])), ctx, extras);
  return new Map(cards.map((c) => [c.id, c]));
}

export async function getThread(auth: AuthContext, threadId: string): Promise<{ id: string; title: string | null; filters: SearchFilters | null; softPreferences: string[]; messages: MatchmakerMessage[] }> {
  const thread = await ownThread(auth, threadId);
  const { data: rows } = await db().from('ai_thread_messages').select('*').eq('thread_id', threadId).order('created_at').limit(200);
  const viewer = await loadBundle(auth.profile!.id);
  const allIds = (rows ?? []).flatMap((r) => ((r.structured as unknown as MatchmakerStructured | null)?.resultIds ?? []));
  const cards = viewer ? await cardsFor(viewer, allIds) : new Map<string, ProfileCard>();
  const last = (thread.last_filters as unknown as (SearchFilters & { softPreferences?: string[] }) | null) ?? null;
  const { softPreferences: lastSoft = [], ...lastFilters } = last ?? {};
  return {
    id: thread.id,
    title: thread.title,
    filters: last ? (lastFilters as SearchFilters) : null,
    softPreferences: lastSoft,
    messages: (rows ?? []).map((r) => {
      const structured = (r.structured as unknown as MatchmakerStructured | null) ?? null;
      return {
        id: r.id,
        role: r.role as 'user' | 'assistant',
        content: r.content,
        createdAt: r.created_at,
        structured,
        // Profiles that are no longer visible (blocked, hidden) silently drop out.
        results: (structured?.resultIds ?? []).flatMap((id) => (cards.get(id) ? [cards.get(id)!] : [])),
      };
    }),
  };
}

export interface PreparedTurn {
  threadId: string;
  run: () => Promise<{ messageId: string; reply: string; structured: MatchmakerStructured }>;
}

/**
 * Validate quota/consent, ensure a thread exists and store the user message.
 * Returns a runner that performs the (slow) model + search work so the route
 * can start streaming immediately.
 */
export async function prepareTurn(auth: AuthContext, input: { threadId?: string; message: string; locale?: AppLocale }): Promise<PreparedTurn> {
  const viewerId = auth.profile!.id;
  const plan = await getPlanState(auth.userId);
  const ai = await aiAvailable('matchmaker_chat');
  if (ai && !(await hasConsent(auth.userId, 'ai_processing'))) {
    throw errors.forbidden('Turn on AI processing in Settings → Privacy to use the matchmaker.');
  }
  await consumeDailyQuota(auth.userId, QUOTA_KEY, plan.entitlements.ai_matchmaker_messages_per_day, 'AI matchmaker messages');

  const c = db();
  let thread = input.threadId ? await ownThread(auth, input.threadId) : null;
  if (!thread) {
    const { data, error } = await c
      .from('ai_threads')
      .insert({ user_id: auth.userId, profile_id: viewerId, kind: 'matchmaker', title: input.message.slice(0, 60) })
      .select('*')
      .single();
    if (error || !data) throw error ?? new Error('thread create failed');
    thread = data;
  }
  const { data: history } = await c
    .from('ai_thread_messages')
    .select('role, content')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS);
  await c.from('ai_thread_messages').insert({ thread_id: thread.id, role: 'user', content: input.message });

  const threadRow = thread;
  const locale = input.locale ?? (auth.user.preferred_locale as AppLocale) ?? 'en';
  const run = async () => {
    const viewer = await loadBundle(viewerId);
    if (!viewer) throw errors.profileIncomplete();
    const current = (threadRow.last_filters as unknown as SearchFilters | null) ?? null;

    let turn: { reply: string; intent: MatchmakerStructured['intent']; filters: SearchFilters; soft: string[]; questions: string[]; title: string | null; generator: 'ai' | 'rules' } | null = null;
    if (ai) {
      try {
        const prefs = viewer.prefs
          ? { seekingGenders: viewer.prefs.seeking_genders, ageMin: viewer.prefs.age_min, ageMax: viewer.prefs.age_max, cities: viewer.prefs.cities, countries: viewer.prefs.countries, diets: viewer.prefs.diets, coreValues: viewer.prefs.core_values, nonNegotiables: viewer.prefs.non_negotiables, freeText: viewer.prefs.free_text }
          : null;
        const transcript = (history ?? []).reverse().map((h) => `${h.role === 'user' ? 'Member' : 'Assistant'}: ${h.content}`).join('\n');
        const { output } = await runStructured({
          feature: 'matchmaker_chat',
          userId: auth.userId,
          schema: TurnSchema,
          extraSystem: `Reply language: ${LOCALE_NAMES[locale] ?? 'English'}.`,
          input: [
            untrusted('my_preferences', prefs ?? 'Not set yet'),
            untrusted('current_filters', current ?? {}),
            untrusted('conversation', transcript || '(new conversation)'),
            untrusted('member_input', input.message),
          ].join('\n\n'),
        });
        const reply = output.reply.trim();
        turn = {
          reply: reply && isSafeCopy(reply) ? reply.slice(0, 1200) : 'Thank you — let me look for people who fit what you shared.',
          intent: output.intent,
          filters: sanitizeFilters(output.filters),
          soft: safeList(cleanList(output.softPreferences, 6, 60)),
          questions: cleanList(output.clarifyingQuestions, 2, 160),
          title: output.title.trim().slice(0, 60) || null,
          generator: 'ai',
        };
      } catch (err) {
        console.error('[ai] matchmaker turn failed; using rules', err instanceof Error ? err.message : err);
      }
    }
    if (!turn) turn = rulesTurn(input.message, current);

    let resultIds: string[] = [];
    let notice: string | null = null;
    let reply = turn.reply;
    let filters = turn.filters;
    let soft = turn.soft;
    if (turn.intent === 'search' || turn.intent === 'refine') {
      const stripped = stripAdvancedFilters(filters, plan.entitlements);
      filters = stripped.filters;
      soft = [...new Set([...soft, ...stripped.soft])].slice(0, 10);
      notice = removedFiltersNotice(stripped.removed);
      const res = await searchProfiles(viewer, { filters, sort: 'relevance', limit: RESULT_LIMIT }, { softPreferences: soft });
      resultIds = res.items.map((i) => i.id);
      if (resultIds.length === 0) reply = `${reply}\n\nI couldn’t find anyone who fits all of that right now. Relaxing one preference — such as the age range or city — usually helps.`;
    }

    const structured: MatchmakerStructured = { intent: turn.intent, filters, softPreferences: soft, clarifyingQuestions: turn.questions, resultIds, generator: turn.generator, notice };
    const { data: msg, error } = await c
      .from('ai_thread_messages')
      .insert({ thread_id: threadRow.id, role: 'assistant', content: reply, structured: structured as unknown as Json })
      .select('id')
      .single();
    if (error || !msg) throw error ?? new Error('message insert failed');
    const patch: { last_filters?: Json; title?: string } = {};
    if (turn.intent === 'search' || turn.intent === 'refine') patch.last_filters = { ...filters, softPreferences: soft } as unknown as Json;
    if (turn.title && (!threadRow.title || threadRow.title === input.message.slice(0, 60))) patch.title = turn.title;
    await c.from('ai_threads').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', threadRow.id);
    return { messageId: msg.id, reply, structured };
  };
  return { threadId: thread.id, run };
}

/** Deterministic turn used when AI is unavailable or fails. */
export function rulesTurn(message: string, current: (SearchFilters & { softPreferences?: string[] }) | null) {
  const parsed = parseSmartQuery(message);
  const found = Object.keys(parsed.filters).length > 0 || parsed.softPreferences.length > 0;
  const { softPreferences: prevSoft = [], ...prevFilters } = current ?? {};
  if (!found && !current) {
    return {
      reply: 'Tell me a little about the person you hope to meet — for example their age range, city, lifestyle, or the values that matter most to you.',
      intent: 'clarify' as const,
      filters: {} as SearchFilters,
      soft: [] as string[],
      questions: parsed.clarifyingQuestions,
      title: null,
      generator: 'rules' as const,
    };
  }
  const refine = !!current && found;
  const filters: SearchFilters = refine ? { ...prevFilters, ...parsed.filters } : found ? parsed.filters : (prevFilters as SearchFilters);
  const soft = [...new Set([...(refine ? prevSoft : []), ...parsed.softPreferences])];
  return {
    reply: `${summarise(parsed.summaryParts.length ? parsed.summaryParts : ['matching your earlier search'], parsed.softPreferences)} Here are some people who fit — you can edit the filters below or tell me more.`,
    intent: (refine ? 'refine' : 'search') as 'refine' | 'search',
    filters,
    soft,
    questions: parsed.clarifyingQuestions,
    title: null,
    generator: 'rules' as const,
  };
}

/** Re-run a search with member-edited filters and record it in the thread. */
export async function applyFilters(auth: AuthContext, threadId: string, filters: SearchFilters, softPreferences: string[]): Promise<MatchmakerMessage> {
  await ownThread(auth, threadId);
  const viewer = await loadBundle(auth.profile!.id);
  if (!viewer) throw errors.profileIncomplete();
  const plan = await getPlanState(auth.userId);
  const stripped = stripAdvancedFilters(filters, plan.entitlements);
  const soft = [...new Set([...softPreferences, ...stripped.soft])].slice(0, 10);
  const res = await searchProfiles(viewer, { filters: stripped.filters, sort: 'relevance', limit: RESULT_LIMIT }, { softPreferences: soft });
  const notice = removedFiltersNotice(stripped.removed);
  const content = res.items.length
    ? `I updated the search with your changes — ${res.items.length === 1 ? 'here is one person' : `here are ${res.items.length} people`} who fit.`
    : 'I updated the search, but nobody fits all of those filters yet. Try relaxing one of them.';
  const structured: MatchmakerStructured = { intent: 'refine', filters: stripped.filters, softPreferences: soft, clarifyingQuestions: [], resultIds: res.items.map((i) => i.id), generator: 'rules', notice };
  const c = db();
  const { data: msg, error } = await c.from('ai_thread_messages').insert({ thread_id: threadId, role: 'assistant', content, structured: structured as unknown as Json }).select('id, created_at').single();
  if (error || !msg) throw error ?? new Error('insert failed');
  await c.from('ai_threads').update({ last_filters: { ...stripped.filters, softPreferences: soft } as unknown as Json, updated_at: new Date().toISOString() }).eq('id', threadId);
  return { id: msg.id, role: 'assistant', content, createdAt: msg.created_at, structured, results: res.items };
}

export async function deleteThread(auth: AuthContext, threadId: string): Promise<void> {
  await ownThread(auth, threadId);
  await db().from('ai_threads').delete().eq('id', threadId);
}
