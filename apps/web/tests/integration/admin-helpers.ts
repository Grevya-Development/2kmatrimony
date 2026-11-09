import { randomUUID } from 'node:crypto';
import { admin, createTestUser, makeAdmin, type TestUser } from './helpers';

/** Create a member with a minimal active profile. */
export async function createMember(label: string, extra: Record<string, unknown> = {}): Promise<TestUser & { profileId: string; profileCode: string }> {
  const u = await createTestUser(label);
  const { data, error } = await admin()
    .from('profiles')
    .insert({ owner_user_id: u.userId, first_name: label, gender: 'female', date_of_birth: '1995-05-05', marital_status: 'never_married', current_city: 'Pune', status: 'active', activated_at: new Date().toISOString(), visibility: 'members', ...extra })
    .select('id, profile_code')
    .single();
  if (error) throw error;
  return { ...u, profileId: data.id, profileCode: data.profile_code };
}

export async function createAdmin(label: string, roleKey = 'super_admin'): Promise<TestUser> {
  const u = await createTestUser(label);
  await makeAdmin(u, roleKey);
  return u;
}

export const uniq = (p: string) => `${p}${randomUUID().slice(0, 6)}`.toLowerCase();

/**
 * Admin accounts are intentionally hard to hard-delete (their actions are
 * referenced for accountability). Tests null out those references before
 * deleting the throwaway users they created.
 */
export async function deleteUsers(ids: string[]): Promise<void> {
  const a = admin();
  const nullable: [string, string][] = [
    ['verification_events', 'actor_user_id'], ['verifications', 'reviewer_id'], ['reports', 'assigned_to'],
    ['support_tickets', 'assigned_to'], ['matching_configs', 'created_by'], ['ai_prompts', 'created_by'],
    ['coupons', 'created_by'], ['cms_entries', 'updated_by'], ['notification_templates', 'updated_by'],
    ['feature_flags', 'updated_by'], ['platform_settings', 'updated_by'], ['admin_users', 'created_by'],
    ['refunds', 'requested_by'], ['refunds', 'approved_by'], ['subscriptions', 'granted_by_admin'],
    ['profile_photos', 'moderated_by'], ['profile_videos', 'moderated_by'], ['risk_signals', 'reviewed_by'],
    ['ai_feature_configs', 'updated_by'], ['onboarding_questions', 'updated_by'],
  ];
  for (const id of ids) {
    await a.from('moderation_actions').delete().eq('admin_user_id', id);
    for (const [t, col] of nullable) {
      const q = a.from(t as 'reports') as unknown as { update: (v: Record<string, null>) => { eq: (c: string, v: string) => PromiseLike<unknown> } };
      await q.update({ [col]: null }).eq(col, id);
    }
    const { data: pays } = await a.from('payments').select('id').eq('user_id', id);
    const payIds = (pays ?? []).map((p) => p.id);
    if (payIds.length) {
      await a.from('refunds').delete().in('payment_id', payIds);
      await a.from('invoices').delete().in('payment_id', payIds);
      await a.from('payments').delete().in('id', payIds);
    }
    await a.auth.admin.deleteUser(id);
  }
}
