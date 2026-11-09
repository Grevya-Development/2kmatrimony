import 'server-only';
import { z } from 'zod';
import { AI_FEATURES } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { integrations } from '@/lib/env';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { errors } from '@/server/http';
import { invalidateAiConfigCache } from '@/server/ai/client';
import { invalidatePromptCache, listRegisteredPrompts, SAFETY_PREAMBLE } from '@/server/ai/prompts';
import type { Range } from './common';

export async function aiUsage(r: Range) {
  const c = db();
  const args = { p_from: r.from.toISOString(), p_to: r.to.toISOString() };
  const [usage, requests, cost, feedback, recs] = await Promise.all([
    c.rpc('admin_ai_usage', args),
    c.rpc('admin_timeseries', { ...args, p_metric: 'ai_requests' }),
    c.rpc('admin_timeseries', { ...args, p_metric: 'ai_cost' }),
    c.from('ai_feedback').select('feature, rating').gte('created_at', args.p_from).lt('created_at', args.p_to).limit(20000),
    c.rpc('admin_matching_stats', args),
  ]);
  if (usage.error) throw usage.error;
  const rows = usage.data ?? [];
  const fb = new Map<string, { positive: number; negative: number }>();
  for (const f of feedback.data ?? []) {
    const e = fb.get(f.feature) ?? { positive: 0, negative: 0 };
    if (f.rating > 0) e.positive++; else e.negative++;
    fb.set(f.feature, e);
  }
  const totals = rows.reduce(
    (t, x) => ({
      requests: t.requests + Number(x.requests), errors: t.errors + Number(x.errors), refusals: t.refusals + Number(x.refusals),
      inputTokens: t.inputTokens + Number(x.input_tokens), outputTokens: t.outputTokens + Number(x.output_tokens),
      cacheReadTokens: t.cacheReadTokens + Number(x.cache_read_tokens), costUsd: t.costUsd + Number(x.cost_usd_micros) / 1_000_000,
    }),
    { requests: 0, errors: 0, refusals: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 },
  );
  const recStats = (recs.data as { recommendations?: { total: number; interested: number; shortlisted: number } } | null)?.recommendations;
  return {
    anthropicConfigured: integrations.anthropic,
    voyageConfigured: integrations.voyage,
    totals: { ...totals, errorRate: totals.requests ? totals.errors / totals.requests : 0, refusalRate: totals.requests ? totals.refusals / totals.requests : 0 },
    byFeature: rows.map((x) => ({ ...x, costUsd: Number(x.cost_usd_micros) / 1_000_000 })),
    series: (requests.data ?? []).map((d, i) => ({ day: d.day, requests: Number(d.value), costUsd: Number(cost.data?.[i]?.value ?? 0) / 1_000_000 })),
    feedback: [...fb.entries()].map(([feature, v]) => ({ feature, ...v })),
    recommendationAcceptance: recStats && recStats.total ? (recStats.interested + recStats.shortlisted) / recStats.total : null,
  };
}

export async function listFeatureConfigs() {
  const { data, error } = await db().from('ai_feature_configs').select('*').order('feature');
  if (error) throw error;
  return data ?? [];
}

export const featureConfigSchema = z.object({
  provider: z.enum(['anthropic', 'voyage', 'disabled']).optional(),
  model: z.string().trim().min(3).max(80).regex(/^[a-z0-9.\-]+$/, 'Use an exact model id.').optional(),
  effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).nullable().optional(),
  maxTokens: z.number().int().min(0).max(128000).optional(),
  enabled: z.boolean().optional(),
  dailyUserLimit: z.number().int().min(0).max(100000).nullable().optional(),
  promptKey: z.string().trim().max(80).nullable().optional(),
});

export async function updateFeatureConfig(auth: AuthContext, feature: string, input: z.infer<typeof featureConfigSchema>) {
  if (!(AI_FEATURES as readonly string[]).includes(feature)) throw errors.notFound('Unknown AI feature.');
  const c = db();
  const { data: before } = await c.from('ai_feature_configs').select('*').eq('feature', feature).maybeSingle();
  if (!before) throw errors.notFound('Feature config not found.');
  const patch = {
    ...(input.provider !== undefined && { provider: input.provider }),
    ...(input.model !== undefined && { model: input.model }),
    ...(input.effort !== undefined && { effort: input.effort }),
    ...(input.maxTokens !== undefined && { max_tokens: input.maxTokens }),
    ...(input.enabled !== undefined && { enabled: input.enabled }),
    ...(input.dailyUserLimit !== undefined && { daily_user_limit: input.dailyUserLimit }),
    ...(input.promptKey !== undefined && { prompt_key: input.promptKey }),
    updated_by: auth.userId,
  };
  const { error } = await c.from('ai_feature_configs').update(patch).eq('feature', feature);
  if (error) throw error;
  invalidateAiConfigCache();
  await audit(auth, { action: 'admin.ai.config.update', entityType: 'ai_feature_config', entityId: feature, before, after: patch });
}

export async function listPrompts() {
  const [{ data: versions }, { data: configs }] = await Promise.all([
    db().from('ai_prompts').select('id, key, version, system_prompt, notes, is_active, created_by, created_at').order('key').order('version', { ascending: false }),
    db().from('ai_feature_configs').select('prompt_key').not('prompt_key', 'is', null),
  ]);
  const registered = listRegisteredPrompts();
  const keys = new Set([...registered.map((r) => r.key), ...(configs ?? []).map((c) => c.prompt_key!), ...(versions ?? []).map((v) => v.key)]);
  return {
    safetyPreamble: SAFETY_PREAMBLE,
    keys: [...keys].sort().map((key) => ({
      key,
      codeDefault: registered.find((r) => r.key === key)?.text ?? null,
      versions: (versions ?? []).filter((v) => v.key === key),
    })),
  };
}

export const promptCreateSchema = z.object({
  key: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/),
  systemPrompt: z.string().trim().min(20).max(20000),
  notes: z.string().trim().max(500).optional(),
  activate: z.boolean().default(false),
});

export async function createPromptVersion(auth: AuthContext, input: z.infer<typeof promptCreateSchema>) {
  const c = db();
  const { data: last } = await c.from('ai_prompts').select('version').eq('key', input.key).order('version', { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;
  if (input.activate) await c.from('ai_prompts').update({ is_active: false }).eq('key', input.key).eq('is_active', true);
  const { data, error } = await c.from('ai_prompts').insert({ key: input.key, version, system_prompt: input.systemPrompt, notes: input.notes ?? null, is_active: input.activate, created_by: auth.userId }).select('id, version').single();
  if (error) throw error;
  invalidatePromptCache();
  await audit(auth, { action: 'admin.ai.prompt.create', entityType: 'ai_prompt', entityId: data.id, after: { key: input.key, version, activate: input.activate, notes: input.notes } });
  return data;
}

export const promptToggleSchema = z.object({ isActive: z.boolean() });

export async function setPromptActive(auth: AuthContext, id: string, isActive: boolean) {
  const c = db();
  const { data: p } = await c.from('ai_prompts').select('id, key, version, is_active').eq('id', id).maybeSingle();
  if (!p) throw errors.notFound('Prompt version not found.');
  if (isActive) await c.from('ai_prompts').update({ is_active: false }).eq('key', p.key).eq('is_active', true);
  await c.from('ai_prompts').update({ is_active: isActive }).eq('id', id);
  invalidatePromptCache();
  await audit(auth, { action: isActive ? 'admin.ai.prompt.activate' : 'admin.ai.prompt.deactivate', entityType: 'ai_prompt', entityId: id, before: { is_active: p.is_active }, after: { is_active: isActive, key: p.key, version: p.version } });
}
