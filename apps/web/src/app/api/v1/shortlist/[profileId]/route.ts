import { db } from '@/lib/supabase/admin';
import { route } from '@/server/http';

export const DELETE = route<{ profileId: string }>({ profile: 'required' }, async ({ params, auth }) => {
  await db().from('shortlists').delete().eq('owner_profile_id', auth.profile!.id).eq('target_profile_id', params.profileId);
  return { shortlisted: false };
});
