import 'server-only';
import { dnaAnswerSchema, type DnaDimension, type OnboardingQuestion, type QuestionAnswersInput } from '@2k/shared';
import { DNA_DIMENSIONS } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { errors, validate } from '@/server/http';
import { afterProfileChange, requireProfile } from './service';

type Row = {
  key: string; section: string; prompt: string; help_text: string | null; input_type: string; options: unknown;
  maps_to: string | null; is_required: boolean; translations: unknown;
};

/**
 * Columns a configurable question may write to. Anything else is rejected so a
 * mis-configured question can never touch arbitrary data.
 */
const WRITABLE: Record<string, Set<string>> = {
  profiles: new Set(['core_values', 'personality_traits', 'about']),
  profile_values: new Set(['emotional_expectations', 'communication_style', 'conflict_style', 'family_responsibilities', 'career_ambitions', 'financial_philosophy', 'relationship_expectations', 'future_goals', 'independence_level', 'children_preference', 'living_arrangement', 'settle_preference', 'household_split']),
  profile_lifestyle: new Set(['diet', 'smoking', 'drinking', 'fitness', 'travel', 'hobbies', 'interests']),
  profile_family: new Set(['family_structure', 'family_values']),
};

function localize(row: Row, locale: string) {
  const t = (row.translations as Record<string, { prompt?: string; help_text?: string; options?: Record<string, string>; left?: string; right?: string }>)?.[locale];
  let options = row.options as OnboardingQuestion['options'];
  if (t && Array.isArray(options) && t.options) options = options.map((o) => ({ ...o, label: t.options?.[o.value] ?? o.label }));
  if (t && !Array.isArray(options) && options && (t.left || t.right)) options = { left: t.left ?? options.left, right: t.right ?? options.right };
  return { prompt: t?.prompt ?? row.prompt, helpText: t?.help_text ?? row.help_text, options };
}

export async function listQuestions(auth: AuthContext, section?: string): Promise<OnboardingQuestion[]> {
  const c = db();
  let q = c.from('onboarding_questions').select('key, section, prompt, help_text, input_type, options, maps_to, is_required, translations').eq('is_active', true);
  if (section) q = q.eq('section', section);
  const { data, error } = await q.order('section').order('sort_order');
  if (error) throw error;
  const profileId = auth.profile?.id;
  const [responses, dna] = profileId
    ? await Promise.all([
        c.from('question_responses').select('question_key, answer').eq('profile_id', profileId),
        c.from('relationship_dna').select('*').eq('profile_id', profileId),
      ])
    : [{ data: [] }, { data: [] }];
  const answers = new Map((responses.data ?? []).map((r) => [r.question_key, r.answer]));
  const dnaBy = new Map((dna.data ?? []).map((d) => [d.dimension, d]));
  const locale = auth.user.preferred_locale ?? 'en';

  return ((data ?? []) as Row[]).map((row) => {
    const l = localize(row, locale);
    let answer = answers.get(row.key) ?? null;
    if (row.maps_to?.startsWith('dna:')) {
      const d = dnaBy.get(row.maps_to.slice(4));
      if (d) answer = { selfScore: d.self_score, partnerTarget: d.partner_target, importance: d.importance, flexible: d.flexible, statement: d.statement };
    }
    return { key: row.key, section: row.section, prompt: l.prompt, helpText: l.helpText, inputType: row.input_type as OnboardingQuestion['inputType'], options: l.options, mapsTo: row.maps_to, isRequired: row.is_required, answer };
  });
}

function optionValues(options: unknown): string[] {
  return Array.isArray(options) ? options.map((o: { value: string }) => o.value) : [];
}

/** Validate an answer against its question definition; returns the normalised value. */
export function normaliseAnswer(q: Pick<Row, 'key' | 'input_type' | 'options'>, raw: unknown): unknown {
  const bad = (m: string) => errors.validation(`${q.key}: ${m}`);
  switch (q.input_type) {
    case 'scale':
      return validate(dnaAnswerSchema, raw);
    case 'single_select': {
      if (typeof raw !== 'string' || !optionValues(q.options).includes(raw)) throw bad('choose one of the options');
      return raw;
    }
    case 'multi_select': {
      const allowed = optionValues(q.options);
      if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string' || !allowed.includes(v))) throw bad('choose from the options');
      if (raw.length > 5) throw bad('choose up to five');
      return [...new Set(raw as string[])];
    }
    case 'tags': {
      if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string')) throw bad('expected a list');
      return (raw as string[]).map((s) => s.trim()).filter(Boolean).slice(0, 20).map((s) => s.slice(0, 40));
    }
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) throw bad('expected a number');
      return raw;
    }
    case 'text':
    case 'long_text':
    case 'date': {
      if (raw === null || raw === '') return null;
      if (typeof raw !== 'string') throw bad('expected text');
      return raw.trim().slice(0, q.input_type === 'long_text' ? 1000 : 300);
    }
    default:
      throw bad('unsupported question type');
  }
}

export async function saveAnswers(auth: AuthContext, input: QuestionAnswersInput) {
  const p = requireProfile(auth);
  const c = db();
  const keys = input.answers.map((a) => a.questionKey);
  const { data: questions } = await c.from('onboarding_questions').select('key, input_type, options, maps_to').in('key', keys).eq('is_active', true);
  const byKey = new Map((questions ?? []).map((q) => [q.key, q]));

  const tablePatches = new Map<string, Record<string, unknown>>();
  const dnaRows: Record<string, unknown>[] = [];
  const responses: { profile_id: string; question_key: string; answer: never; answered_at: string }[] = [];
  const now = new Date().toISOString();

  for (const a of input.answers) {
    const q = byKey.get(a.questionKey);
    if (!q) throw errors.validation(`Unknown question ${a.questionKey}.`);
    const value = normaliseAnswer(q, a.answer);
    responses.push({ profile_id: p.id, question_key: q.key, answer: value as never, answered_at: now });
    if (!q.maps_to) continue;
    if (q.maps_to.startsWith('dna:')) {
      const dim = q.maps_to.slice(4) as DnaDimension;
      if (!DNA_DIMENSIONS.includes(dim)) continue;
      const v = value as ReturnType<typeof dnaAnswerSchema.parse>;
      dnaRows.push({ profile_id: p.id, dimension: dim, self_score: v.selfScore, partner_target: v.partnerTarget, importance: v.importance, flexible: v.flexible, statement: v.statement ?? null, source: 'explicit', confirmed_at: now });
      continue;
    }
    const [table, column] = q.maps_to.split('.') as [string, string];
    if (!WRITABLE[table]?.has(column)) throw errors.validation(`Question ${q.key} is not mapped to an editable field.`);
    tablePatches.set(table, { ...(tablePatches.get(table) ?? {}), [column]: value });
  }

  if (responses.length) {
    const { error } = await c.from('question_responses').upsert(responses, { onConflict: 'profile_id,question_key' });
    if (error) throw error;
  }
  if (dnaRows.length) {
    const { error } = await c.from('relationship_dna').upsert(dnaRows as never, { onConflict: 'profile_id,dimension' });
    if (error) throw errors.validation('Could not save your answers.', { db: error.message });
  }
  for (const [table, patch] of tablePatches) {
    const { error } = table === 'profiles'
      ? await c.from('profiles').update(patch as never).eq('id', p.id)
      : await c.from(table as 'profile_values').upsert({ profile_id: p.id, ...patch } as never, { onConflict: 'profile_id' });
    if (error) throw errors.validation('One of the answers is not allowed.', { db: error.message });
  }
  return afterProfileChange(auth, p.id, 'questions', null, { keys });
}
