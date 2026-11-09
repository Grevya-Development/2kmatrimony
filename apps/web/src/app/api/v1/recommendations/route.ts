import { track } from '@/server/analytics/track';
import type { RecommendationItem } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { route } from '@/server/http';
import { getPlanState } from '@/server/entitlements';
import { generateRecommendations, getMatchingConfig } from '@/server/matching/service';
import { buildCards, viewerBundle } from '@/server/discovery/cards';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The member's introductions, finite by design:
 *  1. Hand-picked by their matchmaker (any day, until acted upon) — shown first.
 *  2. Today's engine suggestions (generated on demand).
 */
export const GET = route({ profile: 'active' }, async ({ auth }) => {
  const me = auth.profile!;
  const c = db();
  const loadEngine = () => c.from('recommendations').select('*').eq('profile_id', me.id).eq('batch_date', today()).neq('source', 'matchmaker').order('score', { ascending: false });
  const [{ data: picked }, first] = await Promise.all([
    c.from('recommendations').select('*').eq('profile_id', me.id).eq('source', 'matchmaker').in('status', ['new', 'viewed', 'shortlisted']).order('created_at', { ascending: false }).limit(20),
    loadEngine(),
  ]);
  let engine = first.data;
  if (!engine || engine.length === 0) {
    const [plan, config] = await Promise.all([getPlanState(auth.userId), getMatchingConfig()]);
    const limit = Math.min(plan.entitlements.daily_recommendations, config.raw.daily_batch_size ?? 12);
    await generateRecommendations(me.id, limit);
    ({ data: engine } = await loadEngine());
  }
  const pickedIds = new Set((picked ?? []).map((r) => r.candidate_profile_id));
  const list = [...(picked ?? []), ...(engine ?? []).filter((r) => r.status !== 'passed' && !pickedIds.has(r.candidate_profile_id))];
  const viewer = await viewerBundle(me.id);
  const cards = await buildCards(viewer, list.map((r) => r.candidate_profile_id));
  const items: RecommendationItem[] = list.flatMap((r) => {
    const card = cards.get(r.candidate_profile_id);
    return card ? [{ id: r.id, source: r.source as RecommendationItem['source'], reason: r.reason, status: r.status as RecommendationItem['status'], profile: card }] : [];
  });
  void track(auth.userId, 'recommendations_viewed', { count: items.length, hand_picked: pickedIds.size }, auth.platform);
  return items;
});
