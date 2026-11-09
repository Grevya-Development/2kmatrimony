import 'server-only';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';

export type BadgeKind = 'government_id' | 'photo';

const LABEL: Record<BadgeKind, string> = { government_id: 'ID', photo: 'photo' };

/**
 * A verified badge vouches for specific details. When those details change
 * (identity fields for ID verification, the photo set for photo verification),
 * the badge is withdrawn and the approved verification expires, so members
 * can never carry a badge earned by different details.
 */
export async function revokeBadge(auth: AuthContext, profileId: string, kind: BadgeKind, reason: string): Promise<void> {
  const c = db();
  const flag = kind === 'government_id' ? { is_identity_verified: false } : { is_photo_verified: false };
  await c.from('profiles').update(flag).eq('id', profileId);
  const { data: approved } = await c.from('verifications').select('id').eq('profile_id', profileId).eq('kind', kind).eq('status', 'approved');
  for (const v of approved ?? []) {
    await c.from('verifications').update({ status: 'expired' }).eq('id', v.id);
    await c.from('verification_events').insert({ verification_id: v.id, actor_user_id: auth.userId, from_status: 'approved', to_status: 'expired', note: reason });
  }
  await audit(auth, { action: 'verification.badge_revoked', entityType: 'profile', entityId: profileId, metadata: { kind, reason } });
  await notify({
    userId: auth.userId,
    category: 'verification',
    templateKey: 'verification_expired',
    vars: { kind: LABEL[kind], reason },
    data: { href: '/app/verification' },
  });
}
