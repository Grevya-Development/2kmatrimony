import { afterAll, describe, expect, it } from 'vitest';
import { GET as me } from '@/app/api/v1/me/route';
import { GET as health } from '@/app/api/v1/health/route';
import { GET as config } from '@/app/api/v1/config/route';
import { admin, call, createTestUser, makeAdmin, request } from './helpers';

afterAll(async () => {
  // Leave users for debugging when TEST_KEEP=1
  if (!process.env.TEST_KEEP) {
    const { cleanupTestUsers } = await import('./helpers');
    await cleanupTestUsers();
  }
});

describe('foundation', () => {
  it('health reports database ok', async () => {
    const r = await call<{ status: string; database: string }>(health, request('/api/v1/health'));
    expect(r.status).toBe(200);
    expect(r.body.data?.database).toBe('ok');
  });

  it('health hides integration details from the public and shows them to admins', async () => {
    const pub = await call<Record<string, unknown>>(health, request('/api/v1/health'));
    expect(Object.keys(pub.body.data ?? {}).sort()).toEqual(['database', 'status', 'time']);
    const member = await createTestUser('health-member');
    const asMember = await call<Record<string, unknown>>(health, request('/api/v1/health', { token: member.token }));
    expect(asMember.body.data).not.toHaveProperty('integrations');
    const adm = await createTestUser('health-admin');
    await makeAdmin(adm, 'support');
    const asAdmin = await call<Record<string, unknown>>(health, request('/api/v1/health', { token: adm.token }));
    expect(asAdmin.body.data).toHaveProperty('integrations');
    expect(asAdmin.body.data).toHaveProperty('dbLatencyMs');
    await admin().from('admin_users').delete().eq('user_id', adm.userId);
  });

  it('public config exposes only public settings', async () => {
    const r = await call<{ settings: Record<string, unknown> }>(config, request('/api/v1/config'));
    expect(r.status).toBe(200);
    expect(r.body.data?.settings).toHaveProperty('brand');
    expect(r.body.data?.settings).not.toHaveProperty('gst');
  });

  it('me requires authentication', async () => {
    const r = await call(me, request('/api/v1/me'));
    expect(r.status).toBe(401);
    expect(r.body.error?.code).toBe('unauthorized');
  });

  it('me returns free plan, required consents and no profile for a new user', async () => {
    const u = await createTestUser('me');
    const r = await call<import('@2k/shared').MeResponse>(me, request('/api/v1/me', { token: u.token }));
    expect(r.status).toBe(200);
    expect(r.body.data?.user.id).toBe(u.userId);
    expect(r.body.data?.profile).toBeNull();
    expect(r.body.data?.plan.code).toBe('free');
    expect(r.body.data?.plan.entitlements.interests_per_day).toBe(3);
    expect(r.body.data?.consentsRequired).toEqual(['terms', 'privacy']);
    expect(r.body.data?.admin).toBeNull();
  });

  it('rejects a forged token', async () => {
    const r = await call(me, request('/api/v1/me', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad' }));
    expect(r.status).toBe(401);
  });

  it('RLS: a member cannot read another member\'s account row with their own token', async () => {
    const a = await createTestUser('rls-a');
    const b = await createTestUser('rls-b');
    const { createClient } = await import('@supabase/supabase-js');
    const asA = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${a.token}` } }, auth: { persistSession: false } });
    const { data } = await asA.from('app_users').select('id');
    expect(data?.map((r) => r.id)).toEqual([a.userId]);
    const { error: writeErr } = await asA.from('app_users').update({ full_name: 'hacked' }).eq('id', b.userId);
    expect(writeErr).not.toBeNull();
    const { data: check } = await admin().from('app_users').select('full_name').eq('id', b.userId).single();
    expect(check?.full_name).not.toBe('hacked');
  });
});
