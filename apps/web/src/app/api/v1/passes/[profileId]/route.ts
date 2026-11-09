import { db } from '@/lib/supabase/admin';
import { route } from '@/server/http';

/** Undo a pass. */
export const DELETE = route<{ profileId: string }>({ profile: 'required' }, async ({ params, auth }) => {
  const me = auth.profile!;
  await db().from('passes').delete().eq('profile_id', me.id).eq('target_profile_id', params.profileId);
  await db().from('recommendations').update({ status: 'viewed' }).eq('profile_id', me.id).eq('candidate_profile_id', params.profileId).eq('status', 'passed');
  return { passed: false };
});
