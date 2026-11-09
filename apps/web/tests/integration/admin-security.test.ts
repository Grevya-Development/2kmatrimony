import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as overview } from '@/app/api/v1/admin/overview/route';
import { GET as flags } from '@/app/api/v1/admin/flags/route';
import { PATCH as flagPatch } from '@/app/api/v1/admin/flags/[key]/route';
import { POST as inviteAdmin } from '@/app/api/v1/admin/admins/route';
import { PATCH as adminPatch } from '@/app/api/v1/admin/admins/[userId]/route';
import { POST as createRole } from '@/app/api/v1/admin/roles/route';
import { PATCH as rolePatch } from '@/app/api/v1/admin/roles/[id]/route';
import { POST as suspend } from '@/app/api/v1/admin/users/[id]/suspend/route';
import { POST as reactivate } from '@/app/api/v1/admin/users/[id]/reactivate/route';
import { POST as subscription } from '@/app/api/v1/admin/users/[id]/subscription/route';
import { POST as deleteUser } from '@/app/api/v1/admin/users/[id]/delete/route';
import { GET as me } from '@/app/api/v1/me/route';
import { admin, call, createTestUser, request, type TestUser } from './helpers';
import { createAdmin, createMember, deleteUsers, uniq } from './admin-helpers';

/**
 * Security regression tests for admin privilege boundaries (audit findings H2, M1, M2).
 */
const created: string[] = [];
const createdRoles: string[] = [];
let superA: TestUser;
let superB: TestUser;
let opsAdmin: TestUser; // default 'admin' role: users.manage + feature_flags.manage, no admins.manage
let otherOps: TestUser;
let adminManager: TestUser; // custom role holding admins.manage + roles.manage
let adminManagerRoleId: string;

const as = (u: TestUser, body?: unknown, method?: string) => request('/', { token: u.token, body, method });

beforeAll(async () => {
  superA = await createAdmin('sec-super-a', 'super_admin');
  superB = await createAdmin('sec-super-b', 'super_admin');
  opsAdmin = await createAdmin('sec-ops', 'admin');
  otherOps = await createAdmin('sec-ops2', 'admin');
  const { data: role } = await admin().from('admin_roles').insert({ key: uniq('sec_mgr_'), name: 'Admin manager (test)', is_system: false }).select('id').single();
  adminManagerRoleId = role!.id;
  createdRoles.push(role!.id);
  await admin().from('admin_role_permissions').insert([{ role_id: role!.id, permission_key: 'admins.manage' }, { role_id: role!.id, permission_key: 'roles.manage' }, { role_id: role!.id, permission_key: 'users.manage' }]);
  adminManager = await createTestUser('sec-mgr');
  await admin().from('admin_users').insert({ user_id: adminManager.userId, role_id: role!.id, display_name: 'Mgr', mfa_required: false });
  created.push(superA.userId, superB.userId, opsAdmin.userId, otherOps.userId, adminManager.userId);
});

afterAll(async () => {
  await admin().from('feature_flags').update({ enabled: true }).eq('key', 'require_admin_mfa');
  await deleteUsers(created);
  for (const id of createdRoles) {
    await admin().from('admin_users').delete().eq('role_id', id);
    await admin().from('admin_roles').delete().eq('id', id);
  }
});

describe('H2 — security flags are super-admin only', () => {
  it('lists require_admin_mfa as super-admin only', async () => {
    const r = await call<{ key: string; superAdminOnly: boolean }[]>(flags, as(opsAdmin));
    expect(r.body.data?.find((f) => f.key === 'require_admin_mfa')?.superAdminOnly).toBe(true);
  });

  it('a regular admin cannot change require_admin_mfa, but can change ordinary flags', async () => {
    expect((await call(flagPatch, as(opsAdmin, { enabled: false }, 'PATCH'), { key: 'require_admin_mfa' })).status).toBe(403);
    const { data: flag } = await admin().from('feature_flags').select('enabled').eq('key', 'require_admin_mfa').single();
    expect(flag!.enabled).toBe(true);
    const { data: v } = await admin().from('feature_flags').select('rollout_percent').eq('key', 'voice_input').single();
    expect((await call(flagPatch, as(opsAdmin, { rolloutPercent: v!.rollout_percent }, 'PATCH'), { key: 'voice_input' })).status).toBe(200);
  });

  it('a super admin can change it', async () => {
    expect((await call(flagPatch, as(superA, { enabled: true }, 'PATCH'), { key: 'require_admin_mfa' })).status).toBe(200);
  });

  it('super admins still need MFA when the global flag is off', async () => {
    const mfaSuper = await createAdmin('sec-mfa-super', 'super_admin');
    const mfaOps = await createAdmin('sec-mfa-ops', 'admin');
    created.push(mfaSuper.userId, mfaOps.userId);
    await admin().from('admin_users').update({ mfa_required: true }).in('user_id', [mfaSuper.userId, mfaOps.userId]);
    await admin().from('feature_flags').update({ enabled: false }).eq('key', 'require_admin_mfa');
    try {
      // Flag-cache in auth reads the DB directly, so the change applies immediately.
      const sup = await call<unknown>(overview, as(mfaSuper));
      expect(sup.status).toBe(403);
      expect((sup.body.error as unknown as { details?: { mfaRequired?: boolean } })).toBeTruthy();
      expect((await call(overview, as(mfaOps))).status).toBe(200);
    } finally {
      await admin().from('feature_flags').update({ enabled: true }).eq('key', 'require_admin_mfa');
    }
    expect((await call(overview, as(mfaOps))).status).toBe(403);
  });
});

describe('M1 — admin & role management cannot escalate privileges', () => {
  it('admins.manage cannot create a super admin or an admin without MFA', async () => {
    const target = await createTestUser('sec-target');
    created.push(target.userId);
    const { data: superRole } = await admin().from('admin_roles').select('id').eq('key', 'super_admin').single();
    const { data: supportRole } = await admin().from('admin_roles').select('id').eq('key', 'support').single();
    expect((await call(inviteAdmin, as(adminManager, { identifier: target.email, roleId: superRole!.id, displayName: 'Nope' }))).status).toBe(403);
    expect((await call(inviteAdmin, as(adminManager, { identifier: target.email, roleId: supportRole!.id, displayName: 'Nope', mfaRequired: false }))).status).toBe(403);
    expect((await call(inviteAdmin, as(adminManager, { identifier: target.email, roleId: supportRole!.id, displayName: 'Support person' }))).status).toBe(200);
  });

  it('nobody can change their own role, MFA requirement or active state', async () => {
    const { data: superRole } = await admin().from('admin_roles').select('id').eq('key', 'super_admin').single();
    expect((await call(adminPatch, as(adminManager, { roleId: superRole!.id }, 'PATCH'), { userId: adminManager.userId })).status).toBe(403);
    expect((await call(adminPatch, as(adminManager, { mfaRequired: false }, 'PATCH'), { userId: adminManager.userId })).status).toBe(403);
    expect((await call(adminPatch, as(superA, { mfaRequired: false }, 'PATCH'), { userId: superA.userId })).status).toBe(403);
    const { data: row } = await admin().from('admin_users').select('role_id').eq('user_id', adminManager.userId).single();
    expect(row!.role_id).toBe(adminManagerRoleId);
  });

  it('only super admins can touch super admins or change MFA for others', async () => {
    expect((await call(adminPatch, as(adminManager, { isActive: false }, 'PATCH'), { userId: superB.userId })).status).toBe(403);
    expect((await call(adminPatch, as(adminManager, { mfaRequired: false }, 'PATCH'), { userId: otherOps.userId })).status).toBe(403);
    expect((await call(adminPatch, as(superA, { mfaRequired: false }, 'PATCH'), { userId: otherOps.userId })).status).toBe(200);
  });

  it('only super admins can create or edit roles', async () => {
    expect((await call(createRole, as(adminManager, { key: uniq('sec_r_'), name: 'Sneaky', permissions: ['sensitive_data.read'] }))).status).toBe(403);
    expect((await call(rolePatch, as(adminManager, { permissions: ['admins.manage', 'roles.manage', 'sensitive_data.read'] }, 'PATCH'), { id: adminManagerRoleId })).status).toBe(403);
    const { data: perms } = await admin().from('admin_role_permissions').select('permission_key').eq('role_id', adminManagerRoleId);
    expect((perms ?? []).map((p) => p.permission_key).sort()).toEqual(['admins.manage', 'roles.manage', 'users.manage']);
    const ok = await call<{ id: string }>(createRole, as(superA, { key: uniq('sec_r_'), name: 'Legit', permissions: ['users.read'] }));
    expect(ok.status).toBe(200);
    createdRoles.push(ok.body.data!.id);
  });
});

describe('M2 — account actions on admins', () => {
  it('users.manage alone cannot suspend, delete or change plans of admins, nor of yourself', async () => {
    expect((await call(suspend, as(opsAdmin, { reason: 'Locking out the super admin' }), { id: superA.userId })).status).toBe(403);
    expect((await call(suspend, as(opsAdmin, { reason: 'Locking out a fellow admin' }), { id: otherOps.userId })).status).toBe(403);
    expect((await call(deleteUser, as(opsAdmin, { reason: 'Removing the super admin', confirm: 'DELETE' }), { id: superA.userId })).status).toBe(403);
    expect((await call(subscription, as(opsAdmin, { action: 'grant', planCode: 'elite', days: 365, reason: 'Free elite for me please' }), { id: opsAdmin.userId })).status).toBe(403);
    const { data: u } = await admin().from('app_users').select('status').eq('id', superA.userId).single();
    expect(u!.status).toBe('active');
  });

  it('an admins.manage holder still cannot act on a super admin', async () => {
    expect((await call(suspend, as(adminManager, { reason: 'Locking out the super admin' }), { id: superB.userId })).status).toBe(403);
  });

  it('suspending an admin revokes admin access and the suspension applies to admins too', async () => {
    const victim = await createAdmin('sec-victim', 'admin');
    created.push(victim.userId);
    expect((await call(overview, as(victim))).status).toBe(200);
    expect((await call(suspend, as(superA, { reason: 'Compromised admin account' }), { id: victim.userId })).status).toBe(200);
    const { data: row } = await admin().from('admin_users').select('is_active').eq('user_id', victim.userId).single();
    expect(row!.is_active).toBe(false);
    const blocked = await call(overview, as(victim));
    expect([401, 403]).toContain(blocked.status);
    // Even if the admin row were still active, a suspended account is refused.
    await admin().from('admin_users').update({ is_active: true }).eq('user_id', victim.userId);
    const stillBlocked = await call(overview, as(victim));
    expect([401, 403]).toContain(stillBlocked.status);
    if (stillBlocked.status === 403) expect(stillBlocked.body.error?.code).toBe('account_suspended');
    // /me stays reachable for suspended accounts (support & data rights)
    const meRes = await call(me, as(victim));
    expect([200, 401]).toContain(meRes.status);
    expect((await call(reactivate, as(superA, { reason: 'Account secured again' }), { id: victim.userId })).status).toBe(200);
  });

  it('regular members can still be suspended by users.manage admins', async () => {
    const member = await createMember('sec-member');
    created.push(member.userId);
    expect((await call(suspend, as(opsAdmin, { reason: 'Spam reports confirmed' }), { id: member.userId })).status).toBe(200);
  });
});
