import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { POST } from '@/app/api/v1/auth/email-start/route';
import { admin, call, request } from './helpers';

const created: string[] = [];
afterAll(async () => { for (const id of created) await admin().auth.admin.deleteUser(id); });

describe('POST /auth/email-start', () => {
  it('creates a confirmed account for a new address and is idempotent, without revealing existence', async () => {
    const email = `start-${randomUUID().slice(0, 8)}@it.test`;
    const first = await call<{ ok: boolean }>(POST, request('/api/v1/auth/email-start', { body: { email } }));
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ ok: true });
    const { data: row } = await admin().from('app_users').select('id').eq('email', email).single();
    created.push(row!.id);
    const { data: authUser } = await admin().auth.admin.getUserById(row!.id);
    expect(authUser.user?.email_confirmed_at).toBeTruthy();
    const second = await call<{ ok: boolean }>(POST, request('/api/v1/auth/email-start', { body: { email: email.toUpperCase() } }));
    expect(second.body.data).toEqual({ ok: true });
    const { count } = await admin().from('app_users').select('id', { count: 'exact', head: true }).eq('email', email);
    expect(count).toBe(1);
  });
  it('rejects invalid input', async () => {
    const r = await call(POST, request('/api/v1/auth/email-start', { body: { email: 'not-an-email' } }));
    expect(r.status).toBe(422);
  });
});
