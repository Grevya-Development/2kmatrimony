import type { ProfileViewersResponse } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { route } from '@/server/http';
import { getPlanState } from '@/server/entitlements';
import { buildCards, viewerBundle } from '@/server/discovery/cards';

/** Who viewed my profile in the last 30 days (cards on eligible plans; count otherwise). */
export const GET = route({ profile: 'required' }, async ({ auth }): Promise<ProfileViewersResponse> => {
  const me = auth.profile!;
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await db().from('profile_views').select('viewer_profile_id, created_at').eq('viewed_profile_id', me.id).gte('created_at', since).order('created_at', { ascending: false }).limit(500);
  const latest = new Map<string, string>();
  for (const v of data ?? []) if (!latest.has(v.viewer_profile_id)) latest.set(v.viewer_profile_id, v.created_at);
  const plan = await getPlanState(auth.userId);
  if (!plan.entitlements.see_who_viewed) return { count: latest.size, locked: true, items: [] };
  const ids = [...latest.keys()].slice(0, 60);
  const cards = await buildCards(await viewerBundle(me.id), ids);
  return {
    count: latest.size,
    locked: false,
    items: ids.flatMap((id) => { const card = cards.get(id); return card ? [{ viewedAt: latest.get(id)!, profile: card }] : []; }),
  };
});
