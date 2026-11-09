import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as overview } from '@/app/api/v1/admin/overview/route';
import { GET as listUsers } from '@/app/api/v1/admin/users/route';
import { GET as userDetail } from '@/app/api/v1/admin/users/[id]/route';
import { GET as userContact } from '@/app/api/v1/admin/users/[id]/contact/route';
import { POST as suspend } from '@/app/api/v1/admin/users/[id]/suspend/route';
import { POST as reactivate } from '@/app/api/v1/admin/users/[id]/reactivate/route';
import { POST as subscription } from '@/app/api/v1/admin/users/[id]/subscription/route';
import { POST as deleteUser } from '@/app/api/v1/admin/users/[id]/delete/route';
import { GET as verificationDetail } from '@/app/api/v1/admin/verification/[id]/route';
import { POST as verificationDecision } from '@/app/api/v1/admin/verification/[id]/decision/route';
import { GET as verificationQueue } from '@/app/api/v1/admin/verification/route';
import { GET as reports } from '@/app/api/v1/admin/reports/route';
import { GET as reportDetail, PATCH as reportPatch } from '@/app/api/v1/admin/reports/[id]/route';
import { POST as moderate } from '@/app/api/v1/admin/moderation/route';
import { GET as mediaQueue } from '@/app/api/v1/admin/media/route';
import { POST as mediaDecision } from '@/app/api/v1/admin/media/[id]/route';
import { GET as adminProfile, PATCH as profilePatch } from '@/app/api/v1/admin/profiles/[id]/route';
import { GET as riskList } from '@/app/api/v1/admin/risk/route';
import { PATCH as riskPatch } from '@/app/api/v1/admin/risk/[id]/route';
import { GET as configs, POST as createConfig } from '@/app/api/v1/admin/matching/configs/route';
import { POST as activateConfig } from '@/app/api/v1/admin/matching/configs/[id]/activate/route';
import { GET as matchingStats } from '@/app/api/v1/admin/matching/stats/route';
import { POST as testPair } from '@/app/api/v1/admin/matching/test/route';
import { GET as aiUsage } from '@/app/api/v1/admin/ai/usage/route';
import { GET as aiConfigs } from '@/app/api/v1/admin/ai/configs/route';
import { PATCH as aiConfigPatch } from '@/app/api/v1/admin/ai/configs/[feature]/route';
import { GET as prompts, POST as createPrompt } from '@/app/api/v1/admin/ai/prompts/route';
import { PATCH as promptPatch } from '@/app/api/v1/admin/ai/prompts/[id]/route';
import { GET as analytics } from '@/app/api/v1/admin/analytics/route';
import { GET as coupons, POST as createCoupon } from '@/app/api/v1/admin/coupons/route';
import { PATCH as couponPatch, DELETE as couponDelete } from '@/app/api/v1/admin/coupons/[id]/route';
import { GET as plans } from '@/app/api/v1/admin/plans/route';
import { PUT as entitlements } from '@/app/api/v1/admin/plans/[id]/entitlements/route';
import { POST as createRefund, GET as refunds } from '@/app/api/v1/admin/refunds/route';
import { POST as approveRefund } from '@/app/api/v1/admin/refunds/[id]/approve/route';
import { GET as paymentDetail } from '@/app/api/v1/admin/payments/[id]/route';
import { POST as createCms } from '@/app/api/v1/admin/cms/route';
import { PATCH as cmsPatch, DELETE as cmsDelete } from '@/app/api/v1/admin/cms/[id]/route';
import { POST as createTemplate } from '@/app/api/v1/admin/notifications/templates/route';
import { DELETE as templateDelete } from '@/app/api/v1/admin/notifications/templates/[id]/route';
import { POST as preview } from '@/app/api/v1/admin/notifications/preview/route';
import { POST as broadcast } from '@/app/api/v1/admin/notifications/broadcast/route';
import { GET as flags } from '@/app/api/v1/admin/flags/route';
import { PATCH as flagPatch } from '@/app/api/v1/admin/flags/[key]/route';
import { PUT as settingPut } from '@/app/api/v1/admin/settings/[key]/route';
import { POST as createQuestion } from '@/app/api/v1/admin/questions/route';
import { PATCH as questionPatch, DELETE as questionDelete } from '@/app/api/v1/admin/questions/[id]/route';
import { GET as auditList } from '@/app/api/v1/admin/audit/route';
import { GET as adminsList, POST as inviteAdmin } from '@/app/api/v1/admin/admins/route';
import { PATCH as adminPatch } from '@/app/api/v1/admin/admins/[userId]/route';
import { GET as roles, POST as createRole } from '@/app/api/v1/admin/roles/route';
import { PATCH as rolePatch, DELETE as roleDelete } from '@/app/api/v1/admin/roles/[id]/route';
import { GET as system } from '@/app/api/v1/admin/system/route';
import { GET as me } from '@/app/api/v1/me/route';
import { admin, call, createTestUser, request, type TestUser } from './helpers';
import { createAdmin, createMember, deleteUsers, uniq } from './admin-helpers';

let superAdmin: TestUser;
let supportAdmin: TestUser;
let plain: TestUser;
let member: Awaited<ReturnType<typeof createMember>>;
let member2: Awaited<ReturnType<typeof createMember>>;
const created: string[] = [];

beforeAll(async () => {
  superAdmin = await createAdmin('it-super');
  supportAdmin = await createAdmin('it-support', 'support');
  plain = await createTestUser('it-plain');
  member = await createMember('itmember');
  member2 = await createMember('itmembertwo', { gender: 'male' });
  created.push(superAdmin.userId, supportAdmin.userId, plain.userId, member.userId, member2.userId);
});

afterAll(async () => {
  await deleteUsers(created);
});

const sa = (path: string, opts: { method?: string; body?: unknown } = {}) => request(path, { ...opts, token: superAdmin.token });

describe('admin authorization', () => {
  it('rejects non-admins with 403', async () => {
    const r = await call(overview, request('/api/v1/admin/overview', { token: plain.token }));
    expect(r.status).toBe(403);
  });
  it('rejects unauthenticated with 401', async () => {
    expect((await call(overview, request('/api/v1/admin/overview'))).status).toBe(401);
  });
  it('rejects a role without the required permission', async () => {
    const r = await call(createConfig, request('/api/v1/admin/matching/configs', { token: supportAdmin.token, body: {} }));
    expect(r.status).toBe(403);
    const ok = await call(listUsers, request('/api/v1/admin/users', { token: supportAdmin.token }));
    expect(ok.status).toBe(200);
  });
  it('enforces MFA (AAL2) when the admin row requires it', async () => {
    const mfaAdmin = await createAdmin('it-mfa');
    created.push(mfaAdmin.userId);
    await admin().from('admin_users').update({ mfa_required: true }).eq('user_id', mfaAdmin.userId);
    const r = await call(overview, request('/api/v1/admin/overview', { token: mfaAdmin.token }));
    expect(r.status).toBe(403);
    expect((r.body.error as unknown as { details?: { mfaRequired?: boolean } }).details?.mfaRequired).toBe(true);
  });
});

describe('overview & analytics', () => {
  it('returns current and previous metrics with series', async () => {
    const r = await call<{ current: Record<string, number>; previous: Record<string, number>; series: unknown[] }>(overview, sa('/api/v1/admin/overview?from=2026-10-01&to=2026-11-09'));
    expect(r.status).toBe(200);
    expect(r.body.data?.current).toHaveProperty('totalUsers');
    expect(r.body.data?.previous).toHaveProperty('revenuePaise');
    expect(r.body.data?.series.length).toBeGreaterThan(30);
  });
  it('rejects invalid ranges', async () => {
    expect((await call(overview, sa('/api/v1/admin/overview?from=2026-11-09&to=2026-10-01'))).status).toBe(422);
  });
  it('builds every report and exports CSV with permission', async () => {
    for (const report of ['acquisition', 'funnel', 'completion', 'search', 'matching', 'engagement', 'subscriptions', 'revenue', 'retention']) {
      const r = await call<{ report: { columns: unknown[]; rows: unknown[] } }>(analytics, sa(`/api/v1/admin/analytics?report=${report}`));
      expect(r.status, report).toBe(200);
      expect(r.body.data?.report.columns.length).toBeGreaterThan(0);
    }
    const res = await analytics(sa('/api/v1/admin/analytics?report=funnel&format=csv'), { params: Promise.resolve({}) });
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(await res.text()).toContain('Step');
    // support role has no analytics permission at all
    expect((await call(analytics, request('/api/v1/admin/analytics?report=funnel', { token: supportAdmin.token }))).status).toBe(403);
  });
});

describe('user management', () => {
  it('finds a user by profile code with masked contact, and reveals contact with audit', async () => {
    const r = await call<{ items: { id: string; email: string }[] }>(listUsers, sa(`/api/v1/admin/users?q=${member.profileCode}`));
    expect(r.body.data?.items.map((i) => i.id)).toEqual([member.userId]);
    expect(r.body.data?.items[0]!.email).toContain('•••');
    const c = await call<{ email: string }>(userContact, sa(`/api/v1/admin/users/${member.userId}/contact`), { id: member.userId });
    expect(c.body.data?.email).toBe(member.email);
    const { data: log } = await admin().from('audit_logs').select('id').eq('action', 'admin.sensitive.view').eq('entity_id', member.userId).eq('actor_user_id', superAdmin.userId);
    expect(log?.length).toBeGreaterThan(0);
    // support role lacks sensitive_data.read
    expect((await call(userContact, request('/', { token: supportAdmin.token }), { id: member.userId })).status).toBe(403);
  });

  it('suspends and reactivates with audit, moderation history and enforcement', async () => {
    const s = await call(suspend, sa('/', { body: { reason: 'Repeated harassment reports' } }), { id: member2.userId });
    expect(s.status).toBe(200);
    const { data: u } = await admin().from('app_users').select('status').eq('id', member2.userId).single();
    expect(u?.status).toBe('suspended');
    const { data: p } = await admin().from('profiles').select('status').eq('id', member2.profileId).single();
    expect(p?.status).toBe('suspended');
    const detail = await call<{ moderation: { action: string }[]; activity: { action: string }[] }>(userDetail, sa('/'), { id: member2.userId });
    expect(detail.body.data?.moderation.some((m) => m.action === 'suspend')).toBe(true);
    expect(detail.body.data?.activity.some((a) => a.action === 'admin.user.suspend')).toBe(true);
    expect((await call(suspend, sa('/', { body: { reason: 'x' } }), { id: member2.userId })).status).toBe(422);
    const r = await call(reactivate, sa('/', { body: { reason: 'Appeal accepted after review' } }), { id: member2.userId });
    expect(r.status).toBe(200);
    const { data: p2 } = await admin().from('profiles').select('status').eq('id', member2.profileId).single();
    expect(p2?.status).toBe('active');
  });

  it('cannot suspend yourself', async () => {
    expect((await call(suspend, sa('/', { body: { reason: 'Testing self suspend' } }), { id: superAdmin.userId })).status).toBe(409);
  });

  it('grants, extends and cancels subscriptions (reflected in /me)', async () => {
    const g = await call<{ currentPeriodEnd: string }>(subscription, sa('/', { body: { action: 'grant', planCode: 'premium', days: 30, reason: 'Goodwill credit' } }), { id: member.userId });
    expect(g.status).toBe(200);
    const m = await call<{ plan: { code: string } }>(me, request('/api/v1/me', { token: member.token }));
    expect(m.body.data?.plan.code).toBe('premium');
    const e = await call<{ currentPeriodEnd: string }>(subscription, sa('/', { body: { action: 'extend', days: 10, reason: 'Service outage credit' } }), { id: member.userId });
    expect(new Date(e.body.data!.currentPeriodEnd).getTime()).toBeGreaterThan(new Date(g.body.data!.currentPeriodEnd).getTime());
    await call(subscription, sa('/', { body: { action: 'cancel', reason: 'Requested by member' } }), { id: member.userId });
    const m2 = await call<{ plan: { code: string } }>(me, request('/api/v1/me', { token: member.token }));
    expect(m2.body.data?.plan.code).toBe('free');
  });

  it('schedules deletion through data_requests', async () => {
    const victim = await createMember('itdelete');
    created.push(victim.userId);
    const r = await call<{ scheduledFor: string }>(deleteUser, sa('/', { body: { reason: 'Confirmed fraud ring', confirm: 'DELETE' } }), { id: victim.userId });
    expect(r.status).toBe(200);
    const { data } = await admin().from('data_requests').select('kind, status').eq('user_id', victim.userId);
    expect(data).toEqual([{ kind: 'deletion', status: 'pending' }]);
    const { data: u } = await admin().from('app_users').select('status').eq('id', victim.userId).single();
    expect(u?.status).toBe('pending_deletion');
    expect((await call(deleteUser, sa('/', { body: { reason: 'Confirmed fraud ring', confirm: 'DELETE' } }), { id: victim.userId })).status).toBe(409);
  });
});

describe('trust & safety', () => {
  it('approves a government ID verification, sets the badge and notifies', async () => {
    const { data: v } = await admin().from('verifications').insert({ profile_id: member.profileId, kind: 'government_id', status: 'pending', document_paths: [`${member.profileId}/id.jpg`], document_type: 'passport' }).select('id').single();
    const q = await call<{ items: { id: string }[] }>(verificationQueue, sa('/api/v1/admin/verification?status=open&kind=government_id&limit=100'));
    expect(q.body.data?.items.some((i) => i.id === v!.id)).toBe(true);
    const d = await call<{ canSeeDocuments: boolean; verification: { document_paths: string[] } }>(verificationDetail, sa('/'), { id: v!.id });
    expect(d.body.data?.canSeeDocuments).toBe(true);
    const ds = await call<{ canSeeDocuments: boolean; verification: { document_paths: string[] } }>(verificationDetail, request('/', { token: supportAdmin.token }), { id: v!.id });
    expect(ds.status).toBe(403); // support has no verification.review
    expect((await call(verificationDecision, sa('/', { body: { decision: 'rejected' } }), { id: v!.id })).status).toBe(422);
    const r = await call(verificationDecision, sa('/', { body: { decision: 'approved' } }), { id: v!.id });
    expect(r.status).toBe(200);
    const { data: p } = await admin().from('profiles').select('is_identity_verified').eq('id', member.profileId).single();
    expect(p?.is_identity_verified).toBe(true);
    const { data: ev } = await admin().from('verification_events').select('to_status').eq('verification_id', v!.id);
    expect(ev?.map((e) => e.to_status)).toEqual(['approved']);
    const { data: n } = await admin().from('notifications').select('type').eq('user_id', member.userId).eq('type', 'verification_approved');
    expect(n?.length).toBe(1);
  });

  it('handles a report end to end with a warning action', async () => {
    const { data: rep } = await admin().from('reports').insert({ reporter_user_id: member.userId, reporter_profile_id: member.profileId, target_profile_id: member2.profileId, reason: 'spam', details: 'Sent the same promotional text' }).select('id').single();
    const list = await call<{ items: { id: string }[] }>(reports, sa('/api/v1/admin/reports?status=open&limit=100'));
    expect(list.body.data?.items.some((i) => i.id === rep!.id)).toBe(true);
    const assign = await call(reportPatch, sa('/', { method: 'PATCH', body: { assignToMe: true, status: 'in_review' } }), { id: rep!.id });
    expect(assign.status).toBe(200);
    const d = await call<{ target: { id: string }; totalReportsAgainstTarget: number }>(reportDetail, sa('/'), { id: rep!.id });
    expect(d.body.data?.target.id).toBe(member2.profileId);
    expect((await call(reportPatch, sa('/', { method: 'PATCH', body: { status: 'dismissed' } }), { id: rep!.id })).status).toBe(422);
    const act = await call(moderate, sa('/', { body: { action: 'warn', reason: 'Please do not send promotional messages', reportId: rep!.id } }));
    expect(act.status).toBe(200);
    const { data: after } = await admin().from('reports').select('status').eq('id', rep!.id).single();
    expect(after?.status).toBe('actioned');
    const { data: n } = await admin().from('notifications').select('type').eq('user_id', member2.userId).eq('type', 'moderation_warning');
    expect(n?.length).toBe(1);
  });

  it('moderates pending photos', async () => {
    const path = `${member.profileId}/${uniq('ph')}.jpg`;
    const { data: ph } = await admin().from('profile_photos').insert({ profile_id: member.profileId, storage_path: path }).select('id').single();
    const q = await call<{ items: { id: string }[] }>(mediaQueue, sa('/api/v1/admin/media?kind=photo&status=pending&limit=100'));
    expect(q.body.data?.items.some((i) => i.id === ph!.id)).toBe(true);
    expect((await call(mediaDecision, sa('/', { body: { kind: 'photo', decision: 'rejected' } }), { id: ph!.id })).status).toBe(422);
    await call(mediaDecision, sa('/', { body: { kind: 'photo', decision: 'rejected', reason: 'Group photo — face not clear' } }), { id: ph!.id });
    const { data } = await admin().from('profile_photos').select('moderation_status').eq('id', ph!.id).single();
    expect(data?.moderation_status).toBe('rejected');
  });

  it('hides and unhides a profile; admin view includes hidden fields', async () => {
    await admin().from('profiles').update({ religion: 'Declared religion', sensitive_fields_visibility: 'hidden' }).eq('id', member.profileId);
    const v = await call<{ profile: { religion: string } }>(adminProfile, sa('/'), { id: member.profileId });
    expect(v.body.data?.profile.religion).toBe('Declared religion');
    await call(profilePatch, sa('/', { method: 'PATCH', body: { action: 'hide', reason: 'Under investigation' } }), { id: member.profileId });
    expect((await admin().from('profiles').select('status').eq('id', member.profileId).single()).data?.status).toBe('hidden');
    await call(profilePatch, sa('/', { method: 'PATCH', body: { action: 'unhide', reason: 'Investigation closed' } }), { id: member.profileId });
    expect((await admin().from('profiles').select('status').eq('id', member.profileId).single()).data?.status).toBe('active');
  });

  it('reviews risk signals without enforcement', async () => {
    const { data: sig } = await admin().from('risk_signals').insert({ user_id: member2.userId, profile_id: member2.profileId, kind: 'mass_interests', severity: 3, details: { count: 40 } }).select('id').single();
    const l = await call<{ items: { id: string }[] }>(riskList, sa('/api/v1/admin/risk?limit=100'));
    expect(l.body.data?.items.some((i) => i.id === sig!.id)).toBe(true);
    await call(riskPatch, sa('/', { method: 'PATCH', body: { status: 'reviewed_ok' } }), { id: sig!.id });
    const { data: u } = await admin().from('app_users').select('status').eq('id', member2.userId).single();
    expect(u?.status).toBe('active');
  });
});

describe('matching intelligence', () => {
  it('creates versioned configs per region, activates and rolls back', async () => {
    const region = uniq('it-');
    const body = (n: number) => ({ region, weights: { values: n, emotional: 15, personality: 15, future: 15, lifestyle: 10, family: 10, career: 5, location: 5, interests: 5 }, thresholds: { min_recommend_mutual: 55, min_direction: 45, max_asymmetry: 30, min_confidence: 30, daily_batch_size: 12, candidate_pool: 400 }, notes: `Test version ${n}` });
    const v1 = await call<{ id: string; version: number }>(createConfig, sa('/', { body: body(20) }));
    const v2 = await call<{ id: string; version: number }>(createConfig, sa('/', { body: body(30) }));
    expect(v2.body.data?.version).toBe(2);
    let list = await call<{ id: string; is_active: boolean }[]>(configs, sa(`/api/v1/admin/matching/configs?region=${region}`));
    expect(list.body.data?.find((c) => c.is_active)?.id).toBe(v2.body.data?.id);
    await call(activateConfig, sa('/'), { id: v1.body.data!.id });
    list = await call(configs, sa(`/api/v1/admin/matching/configs?region=${region}`));
    expect(list.body.data?.filter((c) => c.is_active).map((c) => c.id)).toEqual([v1.body.data!.id]);
    expect((await call(createConfig, sa('/', { body: { ...body(0), weights: { values: 0, emotional: 0, personality: 0, future: 0, lifestyle: 0, family: 0, career: 0, location: 0, interests: 0 } } }))).status).toBe(422);
    await admin().from('matching_configs').delete().eq('region', region);
  });

  it('returns stats and a pair breakdown', async () => {
    expect((await call(matchingStats, sa('/api/v1/admin/matching/stats'))).status).toBe(200);
    const r = await call<{ mutual: number; aToB: { score: number }; bToA: { score: number } }>(testPair, sa('/', { body: { codeA: member.profileCode, codeB: member2.profileCode } }));
    expect(r.status).toBe(200);
    expect(typeof r.body.data?.mutual).toBe('number');
    expect((await call(testPair, sa('/', { body: { codeA: 'TK0', codeB: member2.profileCode } }))).status).toBe(404);
  });
});

describe('AI operations', () => {
  it('reports usage and edits feature configs and prompts', async () => {
    expect((await call(aiUsage, sa('/api/v1/admin/ai/usage'))).status).toBe(200);
    const cfgs = await call<{ feature: string; daily_user_limit: number | null }[]>(aiConfigs, sa('/'));
    const original = cfgs.body.data!.find((c) => c.feature === 'vision_board_themes')!;
    expect((await call(aiConfigPatch, sa('/', { method: 'PATCH', body: { dailyUserLimit: 7 } }), { feature: 'vision_board_themes' })).status).toBe(200);
    const { data: row } = await admin().from('ai_feature_configs').select('daily_user_limit').eq('feature', 'vision_board_themes').single();
    expect(row?.daily_user_limit).toBe(7);
    await call(aiConfigPatch, sa('/', { method: 'PATCH', body: { dailyUserLimit: original.daily_user_limit } }), { feature: 'vision_board_themes' });
    expect((await call(aiConfigPatch, sa('/', { method: 'PATCH', body: { enabled: false } }), { feature: 'not_a_feature' })).status).toBe(404);

    const key = uniq('it_prompt_').replace(/-/g, '_');
    const p1 = await call<{ id: string; version: number }>(createPrompt, sa('/', { body: { key, systemPrompt: 'Version one of a test prompt for integration.', activate: true } }));
    const p2 = await call<{ id: string; version: number }>(createPrompt, sa('/', { body: { key, systemPrompt: 'Version two of a test prompt for integration.', activate: true } }));
    expect(p2.body.data?.version).toBe(2);
    const { data: active } = await admin().from('ai_prompts').select('id').eq('key', key).eq('is_active', true);
    expect(active?.map((a) => a.id)).toEqual([p2.body.data!.id]);
    await call(promptPatch, sa('/', { method: 'PATCH', body: { isActive: true } }), { id: p1.body.data!.id });
    const { data: active2 } = await admin().from('ai_prompts').select('id').eq('key', key).eq('is_active', true);
    expect(active2?.map((a) => a.id)).toEqual([p1.body.data!.id]);
    const list = await call<{ keys: { key: string }[] }>(prompts, sa('/'));
    expect(list.body.data?.keys.some((k) => k.key === key)).toBe(true);
    await admin().from('ai_prompts').delete().eq('key', key);
  });
});

describe('billing administration', () => {
  it('manages coupons', async () => {
    const code = uniq('IT').toUpperCase();
    const c = await call<{ id: string; code: string }>(createCoupon, sa('/', { body: { code, discountType: 'percent', discountValue: 20 } }));
    expect(c.status).toBe(200);
    expect((await call(createCoupon, sa('/', { body: { code, discountType: 'percent', discountValue: 20 } }))).status).toBe(409);
    expect((await call(createCoupon, sa('/', { body: { code: `${code}X`, discountType: 'percent', discountValue: 150 } }))).status).toBe(422);
    await call(couponPatch, sa('/', { method: 'PATCH', body: { isActive: false } }), { id: c.body.data!.id });
    const list = await call<{ id: string; is_active: boolean }[]>(coupons, sa('/'));
    expect(list.body.data?.find((x) => x.id === c.body.data!.id)?.is_active).toBe(false);
    await call(couponDelete, sa('/', { method: 'DELETE' }), { id: c.body.data!.id });
  });

  it('validates entitlement types', async () => {
    const r = await call<{ plans: { id: string; code: string }[] }>(plans, sa('/'));
    const plus = r.body.data!.plans.find((p) => p.code === 'plus')!;
    expect((await call(entitlements, sa('/', { method: 'PUT', body: { values: { interests_per_day: 'many' } } }), { id: plus.id })).status).toBe(422);
    expect((await call(entitlements, sa('/', { method: 'PUT', body: { values: { not_a_key: true } } }), { id: plus.id })).status).toBe(422);
    const { data: cur } = await admin().from('plan_entitlements').select('value').eq('plan_id', plus.id).eq('key', 'interests_per_day').single();
    expect((await call(entitlements, sa('/', { method: 'PUT', body: { values: { interests_per_day: cur!.value } } }), { id: plus.id })).status).toBe(200);
  });

  it('creates refund requests within the refundable amount and approves them', async () => {
    const { data: plan } = await admin().from('plans').select('id').eq('code', 'plus').single();
    const { data: pay } = await admin().from('payments').insert({ user_id: member.userId, plan_id: plan!.id, list_amount_paise: 99900, amount_paise: 99900, taxable_paise: 84661, gst_paise: 15239, status: 'captured', paid_at: new Date().toISOString() }).select('id').single();
    expect((await call(createRefund, sa('/', { body: { paymentId: pay!.id, amountPaise: 200000, reason: 'Duplicate charge' } }))).status).toBe(422);
    const r = await call<{ id: string }>(createRefund, sa('/', { body: { paymentId: pay!.id, amountPaise: 50000, reason: 'Partial goodwill refund' } }));
    expect(r.status).toBe(200);
    const a = await call<{ approved: boolean; processing: { ok: boolean } }>(approveRefund, sa('/'), { id: r.body.data!.id });
    expect(a.status).toBe(200);
    expect(a.body.data?.approved).toBe(true);
    const d = await call<{ refunds: { id: string }[] }>(paymentDetail, sa('/'), { id: pay!.id });
    expect(d.body.data?.refunds.length).toBe(1);
    expect((await call(refunds, sa('/api/v1/admin/refunds'))).status).toBe(200);
  });
});

describe('content, notifications and configuration', () => {
  it('requires consent before publishing a success story', async () => {
    const slug = uniq('story-');
    const bad = await call(createCms, sa('/', { body: { kind: 'success_story', slug, title: 'Our story', body: 'We met here.', isPublished: true } }));
    expect(bad.status).toBe(422);
    const ok = await call<{ id: string }>(createCms, sa('/', { body: { kind: 'success_story', slug, title: 'Our story', body: 'We met here.', isPublished: false } }));
    expect(ok.status).toBe(200);
    expect((await call(cmsPatch, sa('/', { method: 'PATCH', body: { isPublished: true } }), { id: ok.body.data!.id })).status).toBe(422);
    expect((await call(cmsPatch, sa('/', { method: 'PATCH', body: { isPublished: true, consentReference: 'consent-form-2026-11-01' } }), { id: ok.body.data!.id })).status).toBe(200);
    await call(cmsDelete, sa('/', { method: 'DELETE' }), { id: ok.body.data!.id });
  });

  it('manages templates, previews and dry-runs a broadcast', async () => {
    const key = uniq('it_tpl_').replace(/-/g, '_');
    const t = await call<{ id: string }>(createTemplate, sa('/', { body: { key, channel: 'in_app', body: 'Hello {{name}} from {{city}}' } }));
    expect(t.status).toBe(200);
    const p = await call<{ body: string; variables: string[] }>(preview, sa('/', { body: { body: 'Hello {{name}} from {{city}}', vars: { name: 'Asha', city: 'Pune' } } }));
    expect(p.body.data?.body).toBe('Hello Asha from Pune');
    expect(p.body.data?.variables).toEqual(['name', 'city']);
    await call(templateDelete, sa('/', { method: 'DELETE' }), { id: t.body.data!.id });
    const b = await call<{ recipients: number; sent: number }>(broadcast, sa('/', { body: { title: 'Test broadcast', body: 'Dry run only', dryRun: true } }));
    expect(b.status).toBe(200);
    expect(b.body.data?.sent).toBe(0);
    expect(b.body.data?.recipients).toBeGreaterThan(0);
  });

  it('toggles flags, validates settings and edits questions', async () => {
    const fl = await call<{ key: string; rollout_percent: number }[]>(flags, sa('/'));
    const flag = fl.body.data!.find((f) => f.key === 'voice_input')!;
    expect((await call(flagPatch, sa('/', { method: 'PATCH', body: { rolloutPercent: flag.rollout_percent } }), { key: 'voice_input' })).status).toBe(200);
    const bad = await call(settingPut, sa('/', { method: 'PUT', body: { value: { min_age: 12, max_photos: 6, video_min_seconds: 15, video_max_seconds: 60, about_max_chars: 2000 } } }), { key: 'limits' });
    expect(bad.status).toBe(422);
    const key = uniq('it_q_').replace(/-/g, '_');
    expect((await call(createQuestion, sa('/', { body: { key, section: 'values', prompt: 'Integration scale question?', inputType: 'scale', options: [{ value: 'a', label: 'A' }] } }))).status).toBe(422);
    const q = await call<{ id: string }>(createQuestion, sa('/', { body: { key, section: 'values', prompt: 'Integration scale question?', inputType: 'scale', options: { left: 'Calm', right: 'Lively' }, isActive: false } }));
    expect(q.status).toBe(200);
    expect((await call(questionPatch, sa('/', { method: 'PATCH', body: { key: 'renamed' } }), { id: q.body.data!.id })).status).toBe(422);
    expect((await call(questionPatch, sa('/', { method: 'PATCH', body: { sortOrder: 999 } }), { id: q.body.data!.id })).status).toBe(200);
    await call(questionDelete, sa('/', { method: 'DELETE' }), { id: q.body.data!.id });
    await admin().from('onboarding_questions').delete().eq('id', q.body.data!.id);
  });

  it('lists audit entries with filters', async () => {
    const r = await call<{ items: { action: string; entity_id: string }[] }>(auditList, sa(`/api/v1/admin/audit?action=admin.user.suspend&entityId=${member2.userId}`));
    expect(r.body.data?.items.length).toBeGreaterThan(0);
    expect(r.body.data?.items.every((i) => i.action.startsWith('admin.user.suspend'))).toBe(true);
  });
});

describe('super admin', () => {
  it('manages admins and roles with safeguards', async () => {
    const { data: supportRole } = await admin().from('admin_roles').select('id').eq('key', 'support').single();
    const inv = await call(inviteAdmin, sa('/', { body: { identifier: plain.email, roleId: supportRole!.id, displayName: 'Plain Person', mfaRequired: false } }));
    expect(inv.status).toBe(200);
    expect((await call(inviteAdmin, sa('/', { body: { identifier: plain.email, roleId: supportRole!.id, displayName: 'Plain Person' } }))).status).toBe(409);
    expect((await call(inviteAdmin, sa('/', { body: { identifier: 'nobody@nowhere.test', roleId: supportRole!.id, displayName: 'No One' } }))).status).toBe(404);
    const list = await call<{ user_id: string }[]>(adminsList, sa('/'));
    expect(list.body.data?.some((a) => a.user_id === plain.userId)).toBe(true);
    await call(adminPatch, sa('/', { method: 'PATCH', body: { isActive: false } }), { userId: plain.userId });
    expect((await call(adminPatch, sa('/', { method: 'PATCH', body: { isActive: false } }), { userId: superAdmin.userId })).status).toBe(409);
    // support role cannot manage admins
    expect((await call(adminsList, request('/', { token: supportAdmin.token }))).status).toBe(403);

    const key = uniq('it_role_').replace(/-/g, '_');
    const role = await call<{ id: string }>(createRole, sa('/', { body: { key, name: 'Integration role', permissions: ['users.read'] } }));
    expect(role.status).toBe(200);
    await call(rolePatch, sa('/', { method: 'PATCH', body: { permissions: ['users.read', 'profiles.read'] } }), { id: role.body.data!.id });
    const r = await call<{ roles: { id: string; permissions: string[] }[] }>(roles, sa('/'));
    expect(r.body.data?.roles.find((x) => x.id === role.body.data!.id)?.permissions.sort()).toEqual(['profiles.read', 'users.read']);
    const superRole = r.body.data!.roles.find((x) => x.permissions.includes('*'))!;
    expect((await call(rolePatch, sa('/', { method: 'PATCH', body: { name: 'Hacked' } }), { id: superRole.id })).status).toBe(409);
    expect((await call(roleDelete, sa('/', { method: 'DELETE' }), { id: role.body.data!.id })).status).toBe(200);
    await admin().from('admin_users').delete().eq('user_id', plain.userId);
  });

  it('reports system status', async () => {
    const r = await call<{ health: { database: string }; queues: Record<string, number> }>(system, sa('/'));
    expect(r.body.data?.health.database).toBe('ok');
    expect(r.body.data?.queues).toHaveProperty('pendingVerifications');
  });
});
