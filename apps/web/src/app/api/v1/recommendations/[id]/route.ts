import { recommendationActionSchema } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { errors, parseJson, route } from '@/server/http';

export const POST = route<{ id: string }>({ profile: 'active' }, async ({ req, params, auth }) => {
  const { action } = await parseJson(req, recommendationActionSchema);
  const me = auth.profile!;
  const { data: rec } = await db().from('recommendations').select('id, candidate_profile_id, status').eq('id', params.id).eq('profile_id', me.id).maybeSingle();
  if (!rec) throw errors.notFound('Recommendation not found.');
  if (action === 'passed') {
    await db().from('passes').upsert({ profile_id: me.id, target_profile_id: rec.candidate_profile_id }, { onConflict: 'profile_id,target_profile_id', ignoreDuplicates: true });
  } else if (action === 'shortlisted') {
    await db().from('shortlists').upsert({ owner_profile_id: me.id, target_profile_id: rec.candidate_profile_id, added_by_user_id: auth.userId }, { onConflict: 'owner_profile_id,target_profile_id', ignoreDuplicates: true });
  }
  // Never downgrade a stronger state (interested/shortlisted) to "viewed".
  const keep = action === 'viewed' && rec.status !== 'new';
  if (!keep) await db().from('recommendations').update({ status: action }).eq('id', rec.id);
  return { id: rec.id, status: keep ? rec.status : action };
});
