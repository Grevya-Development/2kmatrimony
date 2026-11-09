import { afterAll, describe, expect, it } from 'vitest';
import { admin, call, request } from './helpers';
import { cleanupCreated, completeRequired, startedUser } from './profile-helpers';
import { POST as exportData } from '@/app/api/v1/privacy/export/route';
import { GET as listRequests } from '@/app/api/v1/privacy/requests/route';
import { POST as scheduleDeletion, DELETE as cancelDeletion } from '@/app/api/v1/privacy/deletion/route';
import { executeDueDeletions } from '@/server/privacy/deletion';

afterAll(cleanupCreated);

describe('privacy operations', () => {
  it('exports the member\'s data as a downloadable JSON file', async () => {
    const u = await startedUser('a-export');
    await completeRequired(u);
    const r = await call<{ url: string; requestId: string }>(exportData, request('/api/v1/privacy/export', { token: u.token, method: 'POST' }));
    expect(r.status).toBe(201);
    const file = await fetch(r.body.data!.url);
    expect(file.ok).toBe(true);
    const json = (await file.json()) as Record<string, unknown>;
    expect((json.profiles as { first_name: string }[])[0]?.first_name).toBe('Ananya');
    expect(json).toHaveProperty('relationship_dna');
    expect(json).toHaveProperty('consent_records');
    expect(JSON.stringify(json)).not.toContain('embedding');
    const list = await call<{ kind: string; status: string }[]>(listRequests, request('/api/v1/privacy/requests', { token: u.token }));
    expect(list.body.data!.some((x) => x.kind === 'export' && x.status === 'completed')).toBe(true);
  });

  it('schedules and cancels deletion, hiding then restoring the profile', async () => {
    const u = await startedUser('a-del-cancel');
    await completeRequired(u);
    const bad = await call(scheduleDeletion, request('/api/v1/privacy/deletion', { token: u.token, body: { confirm: 'yes' } }));
    expect(bad.status).toBe(422);
    const r = await call<{ scheduledFor: string }>(scheduleDeletion, request('/api/v1/privacy/deletion', { token: u.token, body: { confirm: 'DELETE', reason: 'Found someone' } }));
    expect(r.status).toBe(201);
    let { data: user } = await admin().from('app_users').select('status').eq('id', u.userId).single();
    expect(user?.status).toBe('pending_deletion');
    let { data: prof } = await admin().from('profiles').select('status').eq('owner_user_id', u.userId).single();
    expect(prof?.status).toBe('hidden');
    const c = await call(cancelDeletion, request('/api/v1/privacy/deletion', { token: u.token, method: 'DELETE' }));
    expect(c.status).toBe(200);
    ({ data: user } = await admin().from('app_users').select('status').eq('id', u.userId).single());
    expect(user?.status).toBe('active');
    ({ data: prof } = await admin().from('profiles').select('status').eq('owner_user_id', u.userId).single());
    expect(prof?.status).toBe('active');
  });

  it('executes due deletions: erases accounts without payments, anonymises those with payments', async () => {
    const plain = await startedUser('a-del-plain');
    const paid = await startedUser('a-del-paid');
    for (const u of [plain, paid]) {
      await call(scheduleDeletion, request('/api/v1/privacy/deletion', { token: u.token, body: { confirm: 'DELETE' } }));
      await admin().from('data_requests').update({ scheduled_for: new Date(Date.now() - 60_000).toISOString() }).eq('user_id', u.userId).eq('kind', 'deletion');
    }
    await admin().from('payments').insert({ user_id: paid.userId, list_amount_paise: 99900, amount_paise: 99900, taxable_paise: 84661, gst_paise: 15239, status: 'captured' });

    const result = await executeDueDeletions();
    expect(result.deleted).toBeGreaterThanOrEqual(2);

    const { data: gone } = await admin().auth.admin.getUserById(plain.userId);
    expect(gone.user).toBeNull();
    const { data: plainRow } = await admin().from('app_users').select('id').eq('id', plain.userId).maybeSingle();
    expect(plainRow).toBeNull();

    const { data: paidRow } = await admin().from('app_users').select('status, email, phone, full_name').eq('id', paid.userId).single();
    expect(paidRow).toEqual({ status: 'deleted', email: null, phone: null, full_name: null });
    const { data: paidProfile } = await admin().from('profiles').select('id').eq('owner_user_id', paid.userId).maybeSingle();
    expect(paidProfile).toBeNull();
    const { count } = await admin().from('payments').select('id', { count: 'exact', head: true }).eq('user_id', paid.userId);
    expect(count).toBe(1);
    // Clean up the retained payment so the test user can be removed.
    await admin().from('payments').delete().eq('user_id', paid.userId);
  });
});
