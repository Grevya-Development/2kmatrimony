import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@2k/shared';

/**
 * Integration test helpers. Tests call route handlers directly with real
 * Supabase access tokens against the local stack. Every test user has an
 * email ending in @it.test so they can be cleaned up.
 */
export const admin = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export interface TestUser { userId: string; email: string; token: string }

export async function createTestUser(label = 'user'): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@it.test`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password });
  if (e2 || !s.session) throw e2 ?? new Error('signIn failed');
  return { userId: data.user.id, email, token: s.session.access_token };
}

/** Make a test user a super admin (MFA requirement disabled for the row). */
export async function makeAdmin(user: TestUser, roleKey = 'super_admin'): Promise<void> {
  const { data: role } = await admin().from('admin_roles').select('id').eq('key', roleKey).single();
  await admin().from('admin_users').upsert({ user_id: user.userId, role_id: role!.id, display_name: `Test ${roleKey}`, mfa_required: false });
}

export function request(pathname: string, opts: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {}): NextRequest {
  const headers = new Headers(opts.headers);
  if (opts.token) headers.set('authorization', `Bearer ${opts.token}`);
  if (opts.body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(new URL(pathname, 'http://localhost:3000'), {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- route handlers declare their own param shapes
type Handler = (req: NextRequest, ctx: { params: Promise<any> }) => Promise<Response>;

export async function call<T = unknown>(handler: Handler, req: NextRequest, params: Record<string, string> = {}): Promise<{ status: number; body: { data?: T; error?: { code: string; message: string }; nextCursor?: string | null } }> {
  const res = await handler(req, { params: Promise.resolve(params) });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as never };
}

export async function cleanupTestUsers(): Promise<void> {
  const a = admin();
  for (let page = 1; page < 20; page++) {
    const { data } = await a.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) if (u.email?.endsWith('@it.test')) await a.auth.admin.deleteUser(u.id);
    if (users.length < 200) break;
  }
}
