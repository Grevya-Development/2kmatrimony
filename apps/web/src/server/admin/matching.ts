import 'server-only';
import { z } from 'zod';
import { SCORE_DIMENSIONS } from '@2k/shared';
import { buildExplanation, evaluatePair, normaliseConfig } from '@2k/matching';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { errors } from '@/server/http';
import { invalidateMatchingConfig } from '@/server/matching/service';
import { loadBundles } from '@/server/profiles/load';
import { toMatchProfile } from '@/server/profiles/match-profile';
import type { Range } from './common';

export async function matchingStats(r: Range) {
  const { data, error } = await db().rpc('admin_matching_stats', { p_from: r.from.toISOString(), p_to: r.to.toISOString() });
  if (error) throw error;
  return data;
}

export async function listConfigs(region = 'default') {
  const { data, error } = await db().from('matching_configs').select('id, version, region, weights, thresholds, notes, is_active, created_by, created_at').eq('region', region).order('version', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const weightsSchema = z.object(Object.fromEntries(SCORE_DIMENSIONS.map((d) => [d, z.number().min(0).max(100)])) as Record<(typeof SCORE_DIMENSIONS)[number], z.ZodNumber>)
  .refine((w) => Object.values(w).reduce((a, b) => a + b, 0) > 0, 'At least one weight must be greater than zero.');

export const configCreateSchema = z.object({
  region: z.string().trim().min(1).max(40).default('default'),
  weights: weightsSchema,
  thresholds: z.object({
    min_recommend_mutual: z.number().int().min(0).max(100),
    min_direction: z.number().int().min(0).max(100),
    max_asymmetry: z.number().int().min(0).max(100),
    min_confidence: z.number().int().min(0).max(100),
    daily_batch_size: z.number().int().min(1).max(100),
    candidate_pool: z.number().int().min(20).max(2000),
  }),
  notes: z.string().trim().min(3, 'Describe why the weights changed.').max(500),
  activate: z.boolean().default(true),
});

async function activate(region: string, id: string) {
  const c = db();
  const { data: prev } = await c.from('matching_configs').select('id').eq('region', region).eq('is_active', true).maybeSingle();
  if (prev?.id === id) return prev.id;
  if (prev) await c.from('matching_configs').update({ is_active: false }).eq('id', prev.id);
  const { error } = await c.from('matching_configs').update({ is_active: true }).eq('id', id);
  if (error) {
    if (prev) await c.from('matching_configs').update({ is_active: true }).eq('id', prev.id); // restore
    throw error;
  }
  invalidateMatchingConfig();
  return prev?.id ?? null;
}

export async function createConfig(auth: AuthContext, input: z.infer<typeof configCreateSchema>) {
  const c = db();
  const { data: last } = await c.from('matching_configs').select('version').eq('region', input.region).order('version', { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;
  const { data: row, error } = await c.from('matching_configs').insert({ version, region: input.region, weights: input.weights, thresholds: input.thresholds, notes: input.notes, is_active: false, created_by: auth.userId }).select('id, version').single();
  if (error) throw error;
  const previous = input.activate ? await activate(input.region, row.id) : null;
  await audit(auth, { action: 'admin.matching.config.create', entityType: 'matching_config', entityId: row.id, before: previous ? { activeConfigId: previous } : null, after: { version, ...input } });
  return row;
}

export async function activateConfig(auth: AuthContext, id: string) {
  const { data: cfg } = await db().from('matching_configs').select('id, region, version, is_active').eq('id', id).maybeSingle();
  if (!cfg) throw errors.notFound('Configuration not found.');
  if (cfg.is_active) throw errors.conflict('This version is already active.');
  const previous = await activate(cfg.region, id);
  await audit(auth, { action: 'admin.matching.config.activate', entityType: 'matching_config', entityId: id, before: { activeConfigId: previous }, after: { activeConfigId: id, version: cfg.version } });
}

export const testPairSchema = z.object({ codeA: z.string().trim().min(3).max(20), codeB: z.string().trim().min(3).max(20) });

/** Engine breakdown for two profiles (by profile code), both directions. */
export async function testPair(input: z.infer<typeof testPairSchema>) {
  const c = db();
  const { data: rows } = await c.from('profiles').select('id, profile_code').in('profile_code', [input.codeA.toUpperCase(), input.codeB.toUpperCase()]);
  const a = rows?.find((r) => r.profile_code === input.codeA.toUpperCase());
  const b = rows?.find((r) => r.profile_code === input.codeB.toUpperCase());
  if (!a || !b) throw errors.notFound('One or both profile codes were not found.');
  if (a.id === b.id) throw errors.validation('Choose two different profiles.');
  const bundles = await loadBundles([a.id, b.id]);
  const { data: active } = await c.from('matching_configs').select('version, weights, thresholds').eq('region', 'default').eq('is_active', true).maybeSingle();
  const config = active ? normaliseConfig(active) : undefined;
  const pair = evaluatePair(toMatchProfile(bundles.get(a.id)!), toMatchProfile(bundles.get(b.id)!), config);
  const strip = (d: typeof pair.aToB) => ({ score: d.score, confidence: d.confidence, checks: d.checks, dealbreakers: d.dealbreakers, missing: d.missing, dimensions: Object.fromEntries(Object.entries(d.dimensions).map(([k, v]) => [k, { score: v.score === null ? null : Math.round(v.score * 100), notes: v.notes }])) });
  return {
    a: { id: a.id, code: a.profile_code },
    b: { id: b.id, code: b.profile_code },
    mutual: pair.mutual,
    confidence: pair.confidence,
    eligible: pair.eligible,
    recommended: pair.recommended,
    dimensions: pair.dimensions,
    aToB: strip(pair.aToB),
    bToA: strip(pair.bToA),
    explanationForA: buildExplanation(pair, a.id, b.id),
    configVersion: pair.configVersion,
  };
}
