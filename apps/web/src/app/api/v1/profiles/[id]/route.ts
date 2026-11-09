import { db } from '@/lib/supabase/admin';
import { errors, route } from '@/server/http';
import { loadBundle } from '@/server/profiles/load';
import { buildViewerContext, compatibilitySummary, toDetail } from '@/server/profiles/projection';
import { scoreCandidates } from '@/server/matching/service';
import { viewerBundle } from '@/server/discovery/cards';

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Another member's profile, privacy-projected. Records a (deduplicated) view. */
export const GET = route<{ id: string }>({ profile: 'required', rateLimit: { name: 'profile-view', limit: 120, windowSec: 60 } }, async ({ params, auth, req }) => {
  if (!UUID_RE.test(params.id)) throw errors.notFound('Profile not found.');
  const me = auth.profile!;
  if (params.id === me.id) {
    const own = await loadBundle(me.id, { includeUnapprovedMedia: true });
    if (!own) throw errors.notFound('Profile not found.');
    return toDetail(own, await buildViewerContext(me.id, []));
  }
  const [viewer, target] = await Promise.all([viewerBundle(me.id), loadBundle(params.id)]);
  if (!target) throw errors.notFound('Profile not found.');
  const [ctx, scores] = await Promise.all([buildViewerContext(me.id, [params.id]), scoreCandidates(viewer, [target], { persist: true })]);
  const pair = scores.get(params.id);
  const detail = await toDetail(target, ctx, pair ? { compatibility: pair.eligible ? compatibilitySummary(pair.mutual, pair.confidence) : null, sharedInterests: pair.sharedInterests } : {});
  if (!detail) throw errors.notFound('Profile not found.');

  if (me.status === 'active') {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await db().from('profile_views').select('id', { count: 'exact', head: true }).eq('viewer_profile_id', me.id).eq('viewed_profile_id', params.id).gte('created_at', since);
    if (!count) {
      const source = new URL(req.url).searchParams.get('source')?.slice(0, 30) ?? null;
      await db().from('profile_views').insert({ viewer_profile_id: me.id, viewed_profile_id: params.id, source });
    }
    await db().from('recommendations').update({ status: 'viewed' }).eq('profile_id', me.id).eq('candidate_profile_id', params.id).eq('status', 'new');
  }
  return detail;
});
