import 'server-only';
import { z } from 'zod';
import type {
  BeforeYouMeetBriefing,
  ConnectionOverview,
  GapAnalysis,
  InsightEnvelope,
  Json,
  JournalEntry,
  MeetingPlan,
  VisionCategory,
  VisionItem,
  VisionThemes,
} from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { isBlockedBetween } from '@/server/safety/service';
import type { AuthContext } from '@/server/auth';
import { isEnabled } from '@/server/config';
import { getPlanState, requireEntitlement } from '@/server/entitlements';
import { errors } from '@/server/http';
import { explainPair } from '@/server/matching/service';
import { loadBundles } from '@/server/profiles/load';
import { buildViewerContext, compatibilitySummary, toCards, toDetail } from '@/server/profiles/projection';
import { aiAvailable, runStructured, untrusted } from '@/server/ai/client';
import { registerPrompt } from '@/server/ai/prompts';
import { cleanList, groundingFrom, hasConsent, isSafeCopy, safeList, type GroundingProfile } from '@/server/ai/features/common';
import { buildBeforeYouMeet, buildGapAnalysis, buildVisionThemes, GAP_NOTE, type PairFacts } from './builders';

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------
export interface MemberConnection {
  id: string;
  status: 'active' | 'closed';
  createdAt: string;
  profileA: string;
  profileB: string;
  myProfileId: string;
  otherProfileId: string;
}

/** Load a connection the caller belongs to (404 otherwise, to avoid leaking existence). */
export async function loadMemberConnection(auth: AuthContext, connectionId: string, opts: { requireActive?: boolean } = {}): Promise<MemberConnection> {
  const me = auth.profile?.id;
  if (!me) throw errors.profileIncomplete();
  const { data } = await db().from('connections').select('id, status, created_at, profile_a, profile_b').eq('id', connectionId).maybeSingle();
  if (!data || (data.profile_a !== me && data.profile_b !== me)) throw errors.notFound('Connection not found.');
  if (await isBlockedBetween(data.profile_a, data.profile_b)) throw errors.notFound('Connection not found.');
  if (opts.requireActive && data.status !== 'active') throw errors.conflict('This connection has been closed.');
  return {
    id: data.id,
    status: data.status as 'active' | 'closed',
    createdAt: data.created_at,
    profileA: data.profile_a,
    profileB: data.profile_b,
    myProfileId: me,
    otherProfileId: data.profile_a === me ? data.profile_b : data.profile_a,
  };
}

/** Members, or active family members of either side with the given permission. */
export async function loadConnectionForMeetings(auth: AuthContext, connectionId: string): Promise<{ conn: { id: string; status: string; profile_a: string; profile_b: string }; role: 'member' | 'family'; actingForProfileId: string }> {
  const { data } = await db().from('connections').select('id, status, profile_a, profile_b').eq('id', connectionId).maybeSingle();
  if (!data) throw errors.notFound('Connection not found.');
  if (await isBlockedBetween(data.profile_a, data.profile_b)) throw errors.notFound('Connection not found.');
  const me = auth.profile?.id;
  if (me && (data.profile_a === me || data.profile_b === me)) return { conn: data, role: 'member', actingForProfileId: me };
  const { data: fam } = await db()
    .from('family_members')
    .select('profile_id, permissions')
    .eq('member_user_id', auth.userId)
    .eq('status', 'active')
    .in('profile_id', [data.profile_a, data.profile_b]);
  const ok = (fam ?? []).find((f) => f.permissions.includes('coordinate_meetings'));
  if (!ok) throw errors.notFound('Connection not found.');
  return { conn: data, role: 'family', actingForProfileId: ok.profile_id };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export async function connectionOverview(auth: AuthContext, connectionId: string): Promise<ConnectionOverview> {
  const conn = await loadMemberConnection(auth, connectionId);
  const [bundles, ctx, conv, plan, flags, ai] = await Promise.all([
    loadBundles([conn.otherProfileId]),
    buildViewerContext(conn.myProfileId, [conn.otherProfileId]),
    db().from('conversations').select('id').eq('connection_id', conn.id).maybeSingle(),
    getPlanState(auth.userId),
    Promise.all(['gap_analysis', 'before_you_meet', 'vision_board', 'compatibility_journal'].map((k) => isEnabled(k))),
    aiAvailable('gap_analysis'),
  ]);
  const other = bundles.get(conn.otherProfileId);
  if (!other) throw errors.notFound('Connection not found.');
  const result = await explainPair(conn.myProfileId, conn.otherProfileId);
  const extras = new Map(result ? [[conn.otherProfileId, { compatibility: compatibilitySummary(result.pair.mutual, result.pair.confidence), sharedInterests: result.pair.sharedInterests }]] : []);
  const [card] = await toCards([other], ctx, extras);
  if (!card) throw errors.notFound('Connection not found.');
  const [gap, bym, vision, journal] = flags;
  return {
    id: conn.id,
    status: conn.status,
    createdAt: conn.createdAt,
    conversationId: conv.data?.id ?? null,
    other: card,
    explanation: result?.explanation ?? null,
    features: {
      gapAnalysis: !!gap && plan.entitlements.gap_analysis,
      beforeYouMeet: !!bym && plan.entitlements.before_you_meet,
      visionBoard: !!vision,
      journal: !!journal,
      aiAvailable: ai,
    },
  };
}

// ---------------------------------------------------------------------------
// Insights: Gap Analysis & Before You Meet
// ---------------------------------------------------------------------------
type InsightKind = 'gap_analysis' | 'before_you_meet';

const TopicSchema = z.object({ topic: z.string(), detail: z.string() });
const GapSchema = z.object({
  alignments: z.array(TopicSchema),
  differences: z.array(z.object({ topic: z.string(), detail: z.string(), possibleCompromises: z.array(z.string()) })),
  unansweredQuestions: z.array(z.string()),
  suggestedConversations: z.array(z.string()),
});
const AreaSchema = z.object({ area: z.string(), detail: z.string() });
const BymSchema = z.object({
  sharedInterests: z.array(z.string()),
  sharedValues: z.array(z.string()),
  compatibilityAreas: z.array(AreaSchema),
  potentialDifferences: z.array(AreaSchema),
  conversationStarters: z.array(z.string()),
  questionsToDiscuss: z.array(z.string()),
  firstMeetingIdeas: z.array(z.object({ idea: z.string(), why: z.string() })),
});

registerPrompt(
  'gap_analysis',
  `You prepare an optional "Compatibility Gap Analysis" that two connected members can both read.
Input: <engine_facts> (deterministic compatibility analysis), <person_a> and <person_b> (what each has chosen to share), <draft> (a rule-based draft you should improve, not contradict).
Produce: alignments (up to 6 {topic, detail}), differences (up to 5 {topic, detail, possibleCompromises: 1-3 practical ideas}), unansweredQuestions (up to 5), suggestedConversations (up to 5).
Rules: refer to people by first name or "you both"; describe differences neutrally and as normal; never say anyone is incompatible or unsuitable; never rank one person's preference as better; use only provided facts.`,
);
registerPrompt(
  'before_you_meet',
  `You prepare a private "Before You Meet" briefing that two connected members can both read before a first meeting.
Input: <engine_facts>, <person_a>, <person_b>, <draft> (rule-based draft to improve).
Produce: sharedInterests (up to 5), sharedValues, compatibilityAreas (up to 4 {area, detail}), potentialDifferences (up to 4 {area, detail}, gentle), conversationStarters (exactly 5 open questions), questionsToDiscuss (up to 5 important topics to explore before progressing), firstMeetingIdeas (3 {idea, why}, public, relaxed, affordable places in India).
Rules: only use provided facts; no flirting lines; no questions about salary, caste, religion or appearance; never predict outcomes.`,
);

async function groundingPair(conn: MemberConnection): Promise<{ a: GroundingProfile; b: GroundingProfile; facts: PairFacts } | null> {
  const bundles = await loadBundles([conn.myProfileId, conn.otherProfileId]);
  const me = bundles.get(conn.myProfileId);
  const other = bundles.get(conn.otherProfileId);
  if (!me || !other) return null;
  // Each side as the OTHER member is allowed to see it (both read the insight).
  const [ctxMine, ctxTheirs] = await Promise.all([
    buildViewerContext(conn.myProfileId, [conn.otherProfileId]),
    buildViewerContext(conn.otherProfileId, [conn.myProfileId]),
  ]);
  const [otherAsSeenByMe, meAsSeenByOther] = await Promise.all([toDetail(other, ctxMine), toDetail(me, ctxTheirs)]);
  if (!otherAsSeenByMe || !meAsSeenByOther) return null;
  const result = await explainPair(conn.myProfileId, conn.otherProfileId);
  const ex = result?.explanation;
  const facts: PairFacts = {
    dimensions: ex?.dimensions ?? [],
    alignments: ex?.alignments ?? [],
    differences: ex?.differences.filter((d) => !/preference for|outside/i.test(d)) ?? [],
    sharedInterests: ex?.sharedInterests ?? [],
  };
  return { a: groundingFrom(meAsSeenByOther, me, true), b: groundingFrom(otherAsSeenByMe, other, true), facts };
}

function toEnvelope<T>(row: { id: string; kind: string; content: Json; generator: string; created_at: string }): InsightEnvelope<T> {
  return { id: row.id, kind: row.kind as InsightEnvelope<T>['kind'], content: row.content as unknown as T, generator: row.generator as 'engine' | 'ai', createdAt: row.created_at };
}

export async function latestInsight(auth: AuthContext, connectionId: string, kind: InsightKind | 'vision_themes') {
  const conn = await loadMemberConnection(auth, connectionId);
  const { data } = await db()
    .from('connection_insights')
    .select('id, kind, content, generator, created_at')
    .eq('connection_id', conn.id)
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toEnvelope<GapAnalysis | BeforeYouMeetBriefing | VisionThemes>(data) : null;
}

/** Both members must have consented before their data is processed by AI. */
async function bothConsented(conn: MemberConnection): Promise<boolean> {
  const { data } = await db().from('profiles').select('owner_user_id').in('id', [conn.myProfileId, conn.otherProfileId]);
  const owners = (data ?? []).map((r) => r.owner_user_id);
  if (owners.length !== 2) return false;
  const consents = await Promise.all(owners.map((u) => hasConsent(u, 'ai_processing')));
  return consents.every(Boolean);
}

export async function generateInsight(auth: AuthContext, connectionId: string, kind: InsightKind): Promise<InsightEnvelope<GapAnalysis | BeforeYouMeetBriefing>> {
  const conn = await loadMemberConnection(auth, connectionId, { requireActive: true });
  if (!(await isEnabled(kind))) throw errors.featureDisabled();
  const plan = await getPlanState(auth.userId);
  requireEntitlement(plan.entitlements, kind, kind === 'gap_analysis' ? 'Compatibility Gap Analysis' : 'Before You Meet');

  const g = await groundingPair(conn);
  if (!g) throw errors.notFound('Connection not found.');
  const draft = kind === 'gap_analysis' ? buildGapAnalysis(g.a, g.b, g.facts) : buildBeforeYouMeet(g.a, g.b, g.facts);
  let content: GapAnalysis | BeforeYouMeetBriefing = draft;
  let generator: 'engine' | 'ai' = 'engine';
  let model: string | null = null;
  let promptVersion: number | null = null;

  if ((await aiAvailable(kind)) && (await bothConsented(conn))) {
    const input = [
      untrusted('engine_facts', g.facts),
      untrusted('person_a', g.a),
      untrusted('person_b', g.b),
      untrusted('draft', draft),
    ].join('\n\n');
    try {
      if (kind === 'gap_analysis') {
        const r = await runStructured({ feature: 'gap_analysis', userId: auth.userId, schema: GapSchema, input });
        content = sanitizeGap(r.output, draft as GapAnalysis);
        model = r.model; promptVersion = r.promptVersion;
      } else {
        const r = await runStructured({ feature: 'before_you_meet', userId: auth.userId, schema: BymSchema, input });
        content = sanitizeBym(r.output, draft as BeforeYouMeetBriefing);
        model = r.model; promptVersion = r.promptVersion;
      }
      generator = 'ai';
    } catch (err) {
      console.error('[ai] insight generation failed; using engine draft', err instanceof Error ? err.message : err);
    }
  }

  const { data, error } = await db()
    .from('connection_insights')
    .insert({ connection_id: conn.id, kind, requested_by_profile_id: conn.myProfileId, content: content as unknown as NonNullable<Json>, generator, model, prompt_version: promptVersion })
    .select('id, kind, content, generator, created_at')
    .single();
  if (error || !data) throw error ?? new Error('insert failed');
  return toEnvelope(data);
}

const safeTopics = <T extends { detail: string }>(xs: T[], max: number) => xs.filter((x) => isSafeCopy(x.detail) && x.detail.trim()).slice(0, max);

export function sanitizeGap(o: z.infer<typeof GapSchema>, draft: GapAnalysis): GapAnalysis {
  const differences = safeTopics(o.differences, 5).map((d) => ({ topic: d.topic.slice(0, 80), detail: d.detail.slice(0, 300), possibleCompromises: safeList(cleanList(d.possibleCompromises, 3, 200)) }));
  const alignments = safeTopics(o.alignments, 6).map((d) => ({ topic: d.topic.slice(0, 80), detail: d.detail.slice(0, 300) }));
  return {
    alignments: alignments.length ? alignments : draft.alignments,
    differences: differences.length || draft.differences.length === 0 ? differences : draft.differences,
    unansweredQuestions: cleanList(o.unansweredQuestions, 5, 200).length ? cleanList(o.unansweredQuestions, 5, 200) : draft.unansweredQuestions,
    suggestedConversations: safeList(cleanList(o.suggestedConversations, 5, 220)).length ? safeList(cleanList(o.suggestedConversations, 5, 220)) : draft.suggestedConversations,
    note: GAP_NOTE,
  };
}

export function sanitizeBym(o: z.infer<typeof BymSchema>, draft: BeforeYouMeetBriefing): BeforeYouMeetBriefing {
  const pick = (xs: string[], fallback: string[], max: number) => { const c = safeList(cleanList(xs, max, 240)); return c.length ? c : fallback; };
  return {
    sharedInterests: pick(o.sharedInterests, draft.sharedInterests, 5),
    sharedValues: pick(o.sharedValues, draft.sharedValues, 6),
    compatibilityAreas: safeTopics(o.compatibilityAreas, 4).length ? safeTopics(o.compatibilityAreas, 4) : draft.compatibilityAreas,
    potentialDifferences: safeTopics(o.potentialDifferences, 4),
    conversationStarters: pick(o.conversationStarters, draft.conversationStarters, 5),
    questionsToDiscuss: pick(o.questionsToDiscuss, draft.questionsToDiscuss, 5),
    firstMeetingIdeas: o.firstMeetingIdeas.filter((i) => i.idea.trim() && isSafeCopy(i.why)).slice(0, 3).length ? o.firstMeetingIdeas.filter((i) => i.idea.trim() && isSafeCopy(i.why)).slice(0, 3) : draft.firstMeetingIdeas,
    note: draft.note,
  };
}

// ---------------------------------------------------------------------------
// Vision board
// ---------------------------------------------------------------------------
type VisionRow = { id: string; category: string; content: string; is_shared: boolean; author_profile_id: string; created_at: string };
const toVision = (r: VisionRow, me: string): VisionItem => ({ id: r.id, category: r.category as VisionCategory, content: r.content, isShared: r.is_shared, isMine: r.author_profile_id === me, createdAt: r.created_at });

export async function listVision(auth: AuthContext, connectionId: string): Promise<VisionItem[]> {
  const conn = await loadMemberConnection(auth, connectionId);
  const { data } = await db()
    .from('vision_board_items')
    .select('id, category, content, is_shared, author_profile_id, created_at')
    .eq('connection_id', conn.id)
    .or(`author_profile_id.eq.${conn.myProfileId},is_shared.eq.true`)
    .order('created_at');
  return (data ?? []).map((r) => toVision(r, conn.myProfileId));
}

export async function addVision(auth: AuthContext, connectionId: string, input: { category: VisionCategory; content: string; isShared: boolean }): Promise<VisionItem> {
  const conn = await loadMemberConnection(auth, connectionId, { requireActive: true });
  const { data, error } = await db()
    .from('vision_board_items')
    .insert({ connection_id: conn.id, author_profile_id: conn.myProfileId, category: input.category, content: input.content, is_shared: input.isShared })
    .select('id, category, content, is_shared, author_profile_id, created_at')
    .single();
  if (error || !data) throw error ?? new Error('insert failed');
  return toVision(data, conn.myProfileId);
}

export async function updateVision(auth: AuthContext, connectionId: string, itemId: string, patch: { category?: VisionCategory; content?: string; isShared?: boolean }): Promise<VisionItem> {
  const conn = await loadMemberConnection(auth, connectionId, { requireActive: true });
  const update: { category?: string; content?: string; is_shared?: boolean } = {};
  if (patch.category) update.category = patch.category;
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.isShared !== undefined) update.is_shared = patch.isShared;
  const { data } = await db()
    .from('vision_board_items')
    .update(update)
    .eq('id', itemId)
    .eq('connection_id', conn.id)
    .eq('author_profile_id', conn.myProfileId)
    .select('id, category, content, is_shared, author_profile_id, created_at')
    .maybeSingle();
  if (!data) throw errors.notFound('Item not found.');
  return toVision(data, conn.myProfileId);
}

export async function deleteVision(auth: AuthContext, connectionId: string, itemId: string): Promise<void> {
  const conn = await loadMemberConnection(auth, connectionId);
  const { data } = await db().from('vision_board_items').delete().eq('id', itemId).eq('connection_id', conn.id).eq('author_profile_id', conn.myProfileId).select('id');
  if (!data?.length) throw errors.notFound('Item not found.');
}

registerPrompt(
  'vision_board_themes',
  `Two connected members have voluntarily shared items on a couple vision board (<shared_items>, each marked with whose it is: "a" or "b").
Return commonThemes (up to 6 short sentences about hopes they share, in "you both…" voice) and unansweredQuestions (up to 5 gentle questions about areas only one person — or neither — has covered).
Never judge or rank anyone's goals. Use only the items given.`,
);
const ThemesSchema = z.object({ commonThemes: z.array(z.string()), unansweredQuestions: z.array(z.string()) });

export async function visionThemes(auth: AuthContext, connectionId: string): Promise<InsightEnvelope<VisionThemes>> {
  const conn = await loadMemberConnection(auth, connectionId, { requireActive: true });
  if (!(await isEnabled('vision_board'))) throw errors.featureDisabled();
  const { data } = await db().from('vision_board_items').select('category, content, author_profile_id').eq('connection_id', conn.id).eq('is_shared', true);
  const items = (data ?? []).map((r) => ({ category: r.category as VisionCategory, content: r.content, mine: r.author_profile_id === conn.myProfileId }));
  const draft = buildVisionThemes(items);
  let content: VisionThemes = draft;
  let generator: 'engine' | 'ai' = 'engine';
  if (items.length >= 2 && (await aiAvailable('vision_board_themes')) && (await bothConsented(conn))) {
    try {
      const r = await runStructured({
        feature: 'vision_board_themes',
        userId: auth.userId,
        schema: ThemesSchema,
        input: untrusted('shared_items', items.map((i) => ({ who: i.mine ? 'a' : 'b', category: i.category, content: i.content }))),
      });
      const themes = safeList(cleanList(r.output.commonThemes, 6, 220));
      content = { commonThemes: themes.length ? themes : draft.commonThemes, unansweredQuestions: cleanList(r.output.unansweredQuestions, 5, 220), note: draft.note };
      generator = 'ai';
    } catch (err) {
      console.error('[ai] vision themes failed; using rules', err instanceof Error ? err.message : err);
    }
  }
  const { data: row, error } = await db()
    .from('connection_insights')
    .insert({ connection_id: conn.id, kind: 'vision_themes', requested_by_profile_id: conn.myProfileId, content: content as unknown as NonNullable<Json>, generator })
    .select('id, kind, content, generator, created_at')
    .single();
  if (error || !row) throw error ?? new Error('insert failed');
  return toEnvelope<VisionThemes>(row);
}

// ---------------------------------------------------------------------------
// Journal (private to author)
// ---------------------------------------------------------------------------
type JournalRow = { id: string; kind: string; content: string; resolved: boolean; created_at: string; updated_at: string };
const toJournal = (r: JournalRow): JournalEntry => ({ id: r.id, kind: r.kind as JournalEntry['kind'], content: r.content, resolved: r.resolved, createdAt: r.created_at, updatedAt: r.updated_at });
const JOURNAL_COLS = 'id, kind, content, resolved, created_at, updated_at';

export async function listJournal(auth: AuthContext, connectionId: string): Promise<JournalEntry[]> {
  const conn = await loadMemberConnection(auth, connectionId);
  const { data } = await db().from('connection_journal').select(JOURNAL_COLS).eq('connection_id', conn.id).eq('author_profile_id', conn.myProfileId).order('created_at', { ascending: false });
  return (data ?? []).map(toJournal);
}

export async function addJournal(auth: AuthContext, connectionId: string, input: { kind: JournalEntry['kind']; content: string; resolved?: boolean }): Promise<JournalEntry> {
  const conn = await loadMemberConnection(auth, connectionId);
  const { data, error } = await db()
    .from('connection_journal')
    .insert({ connection_id: conn.id, author_profile_id: conn.myProfileId, kind: input.kind, content: input.content, resolved: input.resolved ?? false })
    .select(JOURNAL_COLS)
    .single();
  if (error || !data) throw error ?? new Error('insert failed');
  return toJournal(data);
}

export async function updateJournal(auth: AuthContext, connectionId: string, entryId: string, patch: { kind?: JournalEntry['kind']; content?: string; resolved?: boolean }): Promise<JournalEntry> {
  const conn = await loadMemberConnection(auth, connectionId);
  const { data } = await db()
    .from('connection_journal')
    .update({ ...(patch.kind ? { kind: patch.kind } : {}), ...(patch.content !== undefined ? { content: patch.content } : {}), ...(patch.resolved !== undefined ? { resolved: patch.resolved } : {}) })
    .eq('id', entryId)
    .eq('connection_id', conn.id)
    .eq('author_profile_id', conn.myProfileId)
    .select(JOURNAL_COLS)
    .maybeSingle();
  if (!data) throw errors.notFound('Entry not found.');
  return toJournal(data);
}

export async function deleteJournal(auth: AuthContext, connectionId: string, entryId: string): Promise<void> {
  const conn = await loadMemberConnection(auth, connectionId);
  const { data } = await db().from('connection_journal').delete().eq('id', entryId).eq('connection_id', conn.id).eq('author_profile_id', conn.myProfileId).select('id');
  if (!data?.length) throw errors.notFound('Entry not found.');
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------
type MeetingRow = { id: string; title: string; proposed_at: string; location_text: string | null; notes: string | null; status: string; proposed_by_user_id: string; created_at: string };
const MEETING_COLS = 'id, title, proposed_at, location_text, notes, status, proposed_by_user_id, created_at';

async function memberUserIds(conn: { profile_a: string; profile_b: string }): Promise<Set<string>> {
  const { data } = await db().from('profiles').select('owner_user_id').in('id', [conn.profile_a, conn.profile_b]);
  return new Set((data ?? []).map((r) => r.owner_user_id));
}

function toMeeting(r: MeetingRow, auth: AuthContext, members: Set<string>): MeetingPlan {
  return {
    id: r.id,
    title: r.title,
    proposedAt: r.proposed_at,
    locationText: r.location_text,
    notes: r.notes,
    status: r.status as MeetingPlan['status'],
    proposedByMe: r.proposed_by_user_id === auth.userId,
    proposedByFamily: !members.has(r.proposed_by_user_id),
    createdAt: r.created_at,
  };
}

export async function listMeetings(auth: AuthContext, connectionId: string): Promise<MeetingPlan[]> {
  const { conn } = await loadConnectionForMeetings(auth, connectionId);
  const [{ data }, members] = await Promise.all([
    db().from('meeting_plans').select(MEETING_COLS).eq('connection_id', conn.id).order('proposed_at', { ascending: false }),
    memberUserIds(conn),
  ]);
  return (data ?? []).map((r) => toMeeting(r, auth, members));
}

export async function proposeMeeting(auth: AuthContext, connectionId: string, input: { title: string; proposedAt: string; locationText: string | null; notes: string | null }): Promise<MeetingPlan> {
  const { conn } = await loadConnectionForMeetings(auth, connectionId);
  if (conn.status !== 'active') throw errors.conflict('This connection has been closed.');
  if (new Date(input.proposedAt).getTime() < Date.now() - 60_000) throw errors.validation('Choose a time in the future.');
  const { data, error } = await db()
    .from('meeting_plans')
    .insert({ connection_id: conn.id, proposed_by_user_id: auth.userId, title: input.title, proposed_at: input.proposedAt, location_text: input.locationText, notes: input.notes })
    .select(MEETING_COLS)
    .single();
  if (error || !data) throw error ?? new Error('insert failed');
  return toMeeting(data, auth, await memberUserIds(conn));
}

/**
 * Status rules: accept/decline — a connection member other than the proposer;
 * cancel — the proposer or any member; complete — members only. Family members
 * may propose and cancel their own proposals but never accept on someone's behalf.
 */
export async function updateMeeting(auth: AuthContext, connectionId: string, meetingId: string, status: 'accepted' | 'declined' | 'cancelled' | 'completed'): Promise<MeetingPlan> {
  const { conn, role } = await loadConnectionForMeetings(auth, connectionId);
  const { data: row } = await db().from('meeting_plans').select(MEETING_COLS).eq('id', meetingId).eq('connection_id', conn.id).maybeSingle();
  if (!row) throw errors.notFound('Meeting not found.');
  const members = await memberUserIds(conn);
  const isProposer = row.proposed_by_user_id === auth.userId;
  const allowed =
    (status === 'accepted' || status === 'declined') ? role === 'member' && !isProposer && row.status === 'proposed'
    : status === 'cancelled' ? (isProposer || role === 'member') && ['proposed', 'accepted'].includes(row.status)
    : role === 'member' && row.status === 'accepted';
  if (!allowed) throw errors.forbidden('You can’t make that change to this meeting.');
  const { data } = await db().from('meeting_plans').update({ status }).eq('id', meetingId).select(MEETING_COLS).single();
  return toMeeting(data!, auth, members);
}
