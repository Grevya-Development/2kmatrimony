import 'server-only';
import {
  buildExplanation,
  evaluatePair,
  normaliseConfig,
  DEFAULT_CONFIG,
  type MatchingConfig,
  type PairResult,
} from '@2k/matching';
import type { Json, MatchExplanation } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { loadBundles, type ProfileBundle } from '@/server/profiles/load';
import { maskForViewer, toMatchProfile } from '@/server/profiles/match-profile';

const CONFIG_TTL = 60_000;
const configCache = new Map<string, { at: number; config: MatchingConfig & { raw: { daily_batch_size?: number; candidate_pool?: number } } }>();

export async function getMatchingConfig(region = 'default') {
  const hit = configCache.get(region);
  if (hit && Date.now() - hit.at < CONFIG_TTL) return hit.config;
  const { data } = await db().from('matching_configs').select('version, weights, thresholds').eq('region', region).eq('is_active', true).maybeSingle();
  const base = data ? normaliseConfig(data) : DEFAULT_CONFIG;
  const t = (data?.thresholds ?? {}) as Record<string, unknown>;
  const config = {
    ...base,
    raw: {
      daily_batch_size: typeof t.daily_batch_size === 'number' ? t.daily_batch_size : 12,
      candidate_pool: typeof t.candidate_pool === 'number' ? t.candidate_pool : 400,
    },
  };
  configCache.set(region, { at: Date.now(), config });
  return config;
}

export function invalidateMatchingConfig(): void {
  configCache.clear();
}

const pairKey = (x: string, y: string) => (x < y ? [x, y] as const : [y, x] as const);

/** Persist pair scores (ordered a<b) for analytics and fast lookups. */
export async function storePairScores(pairs: PairResult[]): Promise<void> {
  if (pairs.length === 0) return;
  const rows = pairs.map((p) => {
    const [a, b] = pairKey(p.aId, p.bId);
    const flipped = a !== p.aId;
    return {
      profile_a: a,
      profile_b: b,
      a_to_b: flipped ? p.bToA.score : p.aToB.score,
      b_to_a: flipped ? p.aToB.score : p.bToA.score,
      mutual: p.mutual,
      confidence: p.confidence,
      dimensions: p.dimensions as unknown as NonNullable<Json>,
      dealbreakers: [...p.aToB.dealbreakers, ...p.bToA.dealbreakers].map((d) => d.field) as unknown as NonNullable<Json>,
      config_version: p.configVersion,
      computed_at: new Date().toISOString(),
    };
  });
  const { error } = await db().from('match_scores').upsert(rows, { onConflict: 'profile_a,profile_b' });
  if (error) console.error('[matching] store scores failed', error.message);
}

/** Profiles (among ids) that have an active connection with the viewer. */
export async function activeConnectionSet(viewerId: string, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const unique = [...new Set(ids)].filter((id) => id && id !== viewerId);
  for (let i = 0; i < unique.length; i += 60) {
    const part = unique.slice(i, i + 60);
    const [a, b] = await Promise.all([
      db().from('connections').select('profile_b').eq('profile_a', viewerId).eq('status', 'active').in('profile_b', part),
      db().from('connections').select('profile_a').eq('profile_b', viewerId).eq('status', 'active').in('profile_a', part),
    ]);
    for (const r of a.data ?? []) out.add(r.profile_b);
    for (const r of b.data ?? []) out.add(r.profile_a);
  }
  return out;
}

/**
 * Score viewer against many candidates (already-loaded bundles).
 * Candidates are privacy-masked relative to the viewer (maskForViewer), so
 * hidden attributes never influence anything the viewer can observe.
 */
export async function scoreCandidates(viewer: ProfileBundle, candidates: ProfileBundle[], opts: { persist?: boolean } = {}): Promise<Map<string, PairResult>> {
  const config = await getMatchingConfig();
  const v = toMatchProfile(viewer);
  const out = new Map<string, PairResult>();
  const others = candidates.filter((c) => c.profile.id !== viewer.profile.id);
  const connected = await activeConnectionSet(viewer.profile.id, others.map((c) => c.profile.id));
  for (const c of others) {
    out.set(c.profile.id, evaluatePair(v, maskForViewer(toMatchProfile(c), c, connected.has(c.profile.id)), config));
  }
  if (opts.persist) await storePairScores([...out.values()]);
  return out;
}

/** Engine explanation for one pair, viewer-relative. AI enrichment layers on top (server/ai). */
export async function explainPair(viewerId: string, candidateId: string): Promise<{ explanation: MatchExplanation; pair: PairResult; viewer: ProfileBundle; candidate: ProfileBundle } | null> {
  const bundles = await loadBundles([viewerId, candidateId]);
  const viewer = bundles.get(viewerId);
  const candidate = bundles.get(candidateId);
  if (!viewer || !candidate) return null;
  const pair = (await scoreCandidates(viewer, [candidate], { persist: true })).get(candidateId)!;
  return { explanation: buildExplanation(pair, viewerId, candidateId), pair, viewer, candidate };
}

/**
 * Generate today's recommendations for a profile: SQL prefilter -> mutual
 * scoring -> thresholds -> top N. Idempotent per day.
 */
export async function generateRecommendations(profileId: string, limit: number): Promise<{ created: number; considered: number }> {
  const config = await getMatchingConfig();
  const viewer = (await loadBundles([profileId])).get(profileId);
  if (!viewer || viewer.profile.status !== 'active') return { created: 0, considered: 0 };
  const prefs = viewer.prefs;
  const hardAge = prefs?.non_negotiables.includes('age');
  const slack = hardAge ? 0 : 2;
  const { data: ids, error } = await db().rpc('recommendation_candidates', {
    p_viewer: profileId,
    p_seeking: prefs?.seeking_genders ?? [],
    p_age_min: prefs?.age_min != null ? Math.max(18, prefs.age_min - slack) : null as unknown as number,
    p_age_max: prefs?.age_max != null ? prefs.age_max + slack : null as unknown as number,
    p_limit: config.raw.candidate_pool ?? 400,
  });
  if (error) throw error;
  const candidateIds = (ids ?? []).map((r) => r.profile_id);
  if (candidateIds.length === 0) return { created: 0, considered: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await db().from('recommendations').select('candidate_profile_id').eq('profile_id', profileId).eq('batch_date', today);
  const already = new Set((existing ?? []).map((r) => r.candidate_profile_id));

  const bundles = await loadBundles(candidateIds.filter((id) => !already.has(id)));
  const scored = await scoreCandidates(viewer, [...bundles.values()]);
  const ranked = [...scored.values()]
    .filter((p) => p.recommended)
    .sort((x, y) => y.mutual - x.mutual || y.confidence - x.confidence)
    .slice(0, Math.max(0, limit - already.size));

  await storePairScores(ranked);
  if (ranked.length) {
    const rows = ranked.map((p) => ({
      profile_id: profileId,
      candidate_profile_id: p.bId,
      score: p.mutual,
      source: 'engine' as const,
      reason: buildExplanation(p, profileId, p.bId).headline,
      batch_date: today,
    }));
    const { error: insErr } = await db().from('recommendations').upsert(rows, { onConflict: 'profile_id,candidate_profile_id,batch_date', ignoreDuplicates: true });
    if (insErr) throw insErr;
  }
  return { created: ranked.length, considered: scored.size };
}
