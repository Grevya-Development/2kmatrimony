import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { GET as daily } from '@/app/api/cron/daily/route';
import { GET as hourly } from '@/app/api/cron/hourly/route';
import { expireDataExports, purgeOldLogs, purgeVerificationDocuments } from '@/server/jobs/maintenance';
import { expireSubscriptions, sendRenewalReminders } from '@/server/jobs/subscriptions';
import { admin, request, type TestUser } from './helpers';
import { billingUser, cleanupBillingUsers, priceFor } from './billing-helpers';

const users: TestUser[] = [];
const newUser = async (l: string) => { const u = await billingUser(l); users.push(u); return u; };
afterAll(async () => { await cleanupBillingUsers(users); });

const daysAgoIso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

async function makeProfile(u: TestUser) {
  const { data } = await admin().from('profiles').insert({ owner_user_id: u.userId, first_name: 'Cron' }).select('id').single();
  return data!.id;
}

describe('cron auth', () => {
  it('rejects requests without the cron secret', async () => {
    expect((await daily(request('/api/cron/daily'))).status).toBe(401);
    expect((await hourly(request('/api/cron/hourly', { headers: { authorization: 'Bearer wrong-secret-wrong-secret' } }))).status).toBe(401);
  });
  it('runs the hourly jobs with a JSON summary', async () => {
    const res = await hourly(request('/api/cron/hourly', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    const body = (await res.json()) as { ok: boolean; jobs: { name: string; ok: boolean }[] };
    expect(res.status).toBe(200);
    expect(body.jobs.map((j) => j.name)).toEqual(['subscriptions.expire', 'payments.abandon']);
    expect(body.ok).toBe(true);
  });
  it('runs every daily job isolated, reporting each', async () => {
    const res = await daily(request('/api/cron/daily', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    const body = (await res.json()) as { ok: boolean; jobs: { name: string; ok: boolean; error?: string }[] };
    expect([200, 207]).toContain(res.status);
    expect(body.jobs.map((j) => j.name)).toEqual(expect.arrayContaining(['retention.dataExports', 'retention.verificationDocs', 'retention.logs', 'recommendations.daily', 'subscriptions.reminders']));
    const failed = body.jobs.filter((j) => !j.ok);
    expect(failed, JSON.stringify(failed)).toEqual([]);
  }, 120_000);
});

describe('retention jobs', () => {
  it('expires data exports older than 7 days and deletes the archive', async () => {
    const u = await newUser('export');
    const oldPath = `${u.userId}/old-${randomUUID()}.json`;
    const newPath = `${u.userId}/new-${randomUUID()}.json`;
    await admin().storage.from('data-exports').upload(oldPath, new Blob(['{}'], { type: 'application/json' }));
    await admin().storage.from('data-exports').upload(newPath, new Blob(['{}'], { type: 'application/json' }));
    const { data: rows } = await admin().from('data_requests').insert([
      { user_id: u.userId, kind: 'export', status: 'completed', result_path: oldPath, completed_at: daysAgoIso(8) },
      { user_id: u.userId, kind: 'export', status: 'completed', result_path: newPath, completed_at: daysAgoIso(2) },
    ]).select('id, result_path');
    await expireDataExports();
    const { data: after } = await admin().from('data_requests').select('id, status, result_path').in('id', rows!.map((r) => r.id));
    const old = after!.find((r) => r.id === rows!.find((x) => x.result_path === oldPath)!.id)!;
    const fresh = after!.find((r) => r.id === rows!.find((x) => x.result_path === newPath)!.id)!;
    expect(old).toMatchObject({ status: 'expired', result_path: null });
    expect(fresh).toMatchObject({ status: 'completed', result_path: newPath });
    const { data: list } = await admin().storage.from('data-exports').list(u.userId);
    expect(list!.map((o) => o.name)).toEqual([newPath.split('/')[1]]);
    await admin().storage.from('data-exports').remove([newPath]);
  });

  it('purges verification documents 90 days after a final decision only', async () => {
    const u = await newUser('verif');
    const profileId = await makeProfile(u);
    const docOld = `${profileId}/${randomUUID()}.png`;
    await admin().storage.from('verification-docs').upload(docOld, new Blob(['x'], { type: 'image/png' }));
    const { data: v } = await admin().from('verifications').insert([
      { profile_id: profileId, kind: 'government_id', status: 'approved', reviewed_at: daysAgoIso(91), document_paths: [docOld] },
      { profile_id: profileId, kind: 'photo', status: 'rejected', reviewed_at: daysAgoIso(30), document_paths: [`${profileId}/recent.png`] },
      { profile_id: profileId, kind: 'employment', status: 'pending', document_paths: [`${profileId}/pending.png`] },
    ]).select('id, kind');
    await purgeVerificationDocuments();
    const { data: after } = await admin().from('verifications').select('kind, document_paths').in('id', v!.map((x) => x.id));
    const byKind = Object.fromEntries(after!.map((r) => [r.kind, r.document_paths]));
    expect(byKind.government_id).toEqual([]);
    expect(byKind.photo).toHaveLength(1);
    expect(byKind.employment).toHaveLength(1);
    const { data: list } = await admin().storage.from('verification-docs').list(profileId);
    expect(list ?? []).toHaveLength(0);
    await admin().from('profiles').delete().eq('id', profileId);
  });

  it('purges AI usage logs and analytics events older than 13 months', async () => {
    const u = await newUser('logs');
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const recent = new Date(Date.now() - 300 * 86_400_000).toISOString();
    const feature = `it_${randomUUID().slice(0, 8)}`;
    await admin().from('ai_usage_logs').insert([
      { user_id: u.userId, feature, provider: 'anthropic', model: 'm', status: 'success', created_at: old },
      { user_id: u.userId, feature, provider: 'anthropic', model: 'm', status: 'success', created_at: recent },
    ]);
    await admin().from('analytics_events').insert([
      { user_id: u.userId, event: feature, created_at: old },
      { user_id: u.userId, event: feature, created_at: recent },
    ]);
    await purgeOldLogs();
    const { data: ai } = await admin().from('ai_usage_logs').select('created_at').eq('feature', feature);
    const { data: ev } = await admin().from('analytics_events').select('created_at').eq('event', feature);
    expect(ai).toHaveLength(1);
    expect(ev).toHaveLength(1);
    await admin().from('ai_usage_logs').delete().eq('feature', feature);
    await admin().from('analytics_events').delete().eq('event', feature);
  });
});

describe('subscription lifecycle', () => {
  it('expires lapsed subscriptions and sends reminders once', async () => {
    const u = await newUser('lifecycle');
    const p = await priceFor('plus', 'month');
    const { data: lapsed } = await admin().from('subscriptions').insert({ user_id: u.userId, plan_id: p.planId, status: 'active', current_period_start: daysAgoIso(31), current_period_end: daysAgoIso(1) }).select('id').single();
    await expireSubscriptions();
    const { data: s } = await admin().from('subscriptions').select('status').eq('id', lapsed!.id).single();
    expect(s!.status).toBe('expired');

    const u2 = await newUser('reminder');
    const end = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const { data: sub } = await admin().from('subscriptions').insert({ user_id: u2.userId, plan_id: p.planId, status: 'active', current_period_start: daysAgoIso(25), current_period_end: end }).select('id').single();
    await sendRenewalReminders();
    await sendRenewalReminders();
    const { data: notes } = await admin().from('notifications').select('type').eq('user_id', u2.userId).eq('type', 'subscription_expiring');
    expect(notes).toHaveLength(1);
    const { data: s2 } = await admin().from('subscriptions').select('reminder_7d_sent_at').eq('id', sub!.id).single();
    expect(s2!.reminder_7d_sent_at).not.toBeNull();
    const { data: expiredNote } = await admin().from('notifications').select('type').eq('user_id', u.userId).eq('type', 'subscription_expired');
    expect(expiredNote).toHaveLength(1);
  });
});
