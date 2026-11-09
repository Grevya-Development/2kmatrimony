import 'server-only';
import type { ConsentType, FamilyPermission, MeResponse } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from './auth';
import { getFlags, getSetting } from './config';
import { getPlanState } from './entitlements';
import { signedUrls } from './media';

const REQUIRED_CONSENTS: ConsentType[] = ['terms', 'privacy'];

export async function buildMe(auth: AuthContext): Promise<MeResponse> {
  const c = db();
  const [plan, flags, policy, unread, consents, family, photo] = await Promise.all([
    getPlanState(auth.userId),
    getFlags(),
    getSetting<Record<string, string>>('policy_versions', { terms: '2026-11-01', privacy: '2026-11-01' }),
    c.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', auth.userId).is('read_at', null),
    c.from('current_consents').select('consent_type, policy_version, granted').eq('user_id', auth.userId),
    c.from('family_members').select('profile_id, permissions, profiles(first_name)').eq('member_user_id', auth.userId).eq('status', 'active'),
    auth.profile
      ? c.from('profile_photos').select('storage_path').eq('profile_id', auth.profile.id).eq('is_primary', true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const consentsRequired = REQUIRED_CONSENTS.filter((t) => {
    const row = consents.data?.find((r) => r.consent_type === t);
    return !row || !row.granted || row.policy_version !== policy[t];
  });

  const photoPath = (photo.data as { storage_path: string } | null)?.storage_path;
  const primaryPhotoUrl = photoPath ? (await signedUrls('profile-photos', [photoPath])).get(photoPath) ?? null : null;

  return {
    user: {
      id: auth.userId,
      email: auth.email,
      phone: auth.phone,
      fullName: auth.user.full_name,
      preferredLocale: auth.user.preferred_locale as MeResponse['user']['preferredLocale'],
      status: auth.user.status as MeResponse['user']['status'],
      onboardingCompletedAt: auth.user.onboarding_completed_at,
    },
    profile: auth.profile
      ? {
          id: auth.profile.id,
          profileCode: auth.profile.profile_code,
          status: auth.profile.status as NonNullable<MeResponse['profile']>['status'],
          firstName: auth.profile.first_name,
          createdFor: auth.profile.created_for as NonNullable<MeResponse['profile']>['createdFor'],
          completionPct: auth.profile.completion_pct,
          onboardingStep: auth.profile.onboarding_step,
          primaryPhotoUrl,
        }
      : null,
    plan: { code: plan.code, name: plan.name, currentPeriodEnd: plan.currentPeriodEnd, entitlements: plan.entitlements },
    admin: auth.admin ? { role: auth.admin.roleKey, permissions: auth.admin.isSuperAdmin ? ['*'] : [...auth.admin.permissions], mfaRequired: auth.admin.mfaRequired } : null,
    familyOf: (family.data ?? []).map((f) => ({
      profileId: f.profile_id,
      ownerName: (f.profiles as unknown as { first_name: string | null } | null)?.first_name ?? 'Member',
      permissions: f.permissions as FamilyPermission[],
    })),
    unreadNotifications: unread.count ?? 0,
    consentsRequired,
    featureFlags: flags,
  };
}

/** Touch activity timestamps at most every 5 minutes. */
export async function touchActivity(auth: AuthContext): Promise<void> {
  const last = auth.user.last_active_at ? new Date(auth.user.last_active_at).getTime() : 0;
  if (Date.now() - last < 5 * 60_000) return;
  const now = new Date().toISOString();
  await Promise.all([
    db().from('app_users').update({ last_active_at: now }).eq('id', auth.userId),
    auth.profile ? db().from('profiles').update({ last_active_at: now }).eq('id', auth.profile.id) : Promise.resolve(),
  ]);
}
