import { db } from '@/lib/supabase/admin';
import { audit } from '@/server/audit';
import { route } from '@/server/http';

/** Unblock. Does not restore a closed connection. */
export const DELETE = route<{ profileId: string }>({ profile: 'required' }, async ({ params, auth }) => {
  await db().from('blocks').delete().eq('blocker_profile_id', auth.profile!.id).eq('blocked_profile_id', params.profileId);
  await audit(auth, { action: 'member.unblock', entityType: 'profile', entityId: params.profileId });
  return { blocked: false };
});
