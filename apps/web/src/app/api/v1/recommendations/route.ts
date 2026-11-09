import type { RecommendationItem } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { route } from '@/server/http';
import { getPlanState } from '@/server/entitlements';
import { generateRecommendations, getMatchingConfig } from '@/server/matching/service';
import { buildCards, viewerBundle } from '@/server/discovery/cards';

const today = () => new Date().toISOString().slice(0, 10);

/** Today's curated recommendations. Generated on demand, finite by design. */
export const GET = route({ profile: 'active' }, async ({ auth }) => {
  const me = auth.profile!;
  const load = () => db().from('recommendations').select('*').eq('profile_id', me.id).eq('batch_date', today()).order('score', { ascending: false });
  let { data: rows } = await load();
  if (!rows || rows.length === 0) {
    const [plan, config] = await Promise.all([getPlanState(auth.userId), getMatchingConfig()]);
    const limit = Math.min(plan.entitlements.daily_recommendations, config.raw.daily_batch_size ?? 12);
    await generateRecommendations(me.id, limit);
    ({ data: rows } = await load());
  }
  const list = (rows ?? []).filter((r) => r.status !== 'passed');
  const viewer = await viewerBundle(me.id);
  const cards = await buildCards(viewer, list.map((r) => r.candidate_profile_id));
  const items: RecommendationItem[] = list.flatMap((r) => {
    const card = cards.get(r.candidate_profile_id);
    return card ? [{ id: r.id, source: r.source as RecommendationItem['source'], reason: r.reason, status: r.status as RecommendationItem['status'], profile: card }] : [];
  });
  return items;
});
