import { passSchema } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { errors, parseJson, route } from '@/server/http';

/** Pass on a profile: hidden from recommendations (can be undone). */
export const POST = route({ profile: 'active' }, async ({ req, auth }) => {
  const { targetProfileId } = await parseJson(req, passSchema);
  const me = auth.profile!;
  if (targetProfileId === me.id) throw errors.validation('Invalid profile.');
  const { error } = await db().from('passes').upsert({ profile_id: me.id, target_profile_id: targetProfileId }, { onConflict: 'profile_id,target_profile_id', ignoreDuplicates: true });
  if (error) {
    if (error.code === '23503') throw errors.notFound('Profile not found.');
    throw error;
  }
  await db().from('recommendations').update({ status: 'passed' }).eq('profile_id', me.id).eq('candidate_profile_id', targetProfileId);
  return { passed: true };
});
