import { expect, test, type Page } from '@playwright/test';
import { admin, trackPageErrors } from './support';
import { createActiveMember, makeE2EAdmin } from './users';

/**
 * Smoke test against the HOSTED Supabase project (E2E_TARGET=hosted).
 * Creates its own email members and deletes them at the end.
 */
test.describe.configure({ mode: 'serial' });
// Hosted runs cross the public internet from a dev machine (new TLS connections to
// Supabase can take several seconds on some networks), so allow generous timeouts.
// Functional assertions are unchanged.
test.setTimeout(900_000);
test.use({ actionTimeout: 60_000, navigationTimeout: 90_000 });
expect.configure({ timeout: 60_000 });

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const suffix = Math.random().toString(36).slice(2, 7);
const names = { a: `Aarohi${suffix}`, b: `Vikram${suffix}` };
type M = Awaited<ReturnType<typeof createActiveMember>>;
let A: M;
let B: M;
const errorLogs: string[][] = []; // live arrays filled by page listeners

test.afterAll(async () => {
  for (const m of [A, B]) {
    if (!m) continue;
    await m.ctx.close().catch(() => undefined);
    await admin().from('admin_users').delete().eq('user_id', m.user.userId);
    await admin().auth.admin.deleteUser(m.user.userId);
  }
});

test('hosted backend is healthy and configured', async ({ request }) => {
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toContain('supabase.co');
  const health = await (await request.get('/api/v1/health')).json();
  expect(health.data).toMatchObject({ status: 'ok', database: 'ok' });
  const { data: plans } = await admin().from('plans').select('code').order('sort_order');
  expect(plans?.map((p) => p.code)).toEqual(['free', 'plus', 'premium', 'elite']);
});

test('public pages render', async ({ page }) => {
  errorLogs.push(trackPageErrors(page));
  for (const path of ['/', '/pricing', '/login', '/legal/privacy']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'More Than a Match. A Meaningful Beginning.' })).toBeVisible();
  await page.goto('/pricing');
  await expect(page.getByText('Premium').first()).toBeVisible();
});

test('two members sign in through the UI and complete profiles', async ({ browser }) => {
  A = await createActiveMember(browser, { label: 'hosted-a', firstName: names.a, gender: 'female', seeking: 'male' });
  B = await createActiveMember(browser, { label: 'hosted-b', firstName: names.b, gender: 'male', seeking: 'female' });
  errorLogs.push(trackPageErrors(A.page), trackPageErrors(B.page));
});

// The UI flows below are fully covered locally (journey.spec.ts). Against hosted
// we verify the infrastructure-specific behaviour (Storage, SQL functions,
// Realtime, RLS, admin API) through the same API the UI uses.
async function apiJson(page: Page, method: 'GET' | 'POST', path: string, data?: unknown) {
  const res = await page.request.fetch(`/api/v1${path}`, { method, data, timeout: 180_000 });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body: body as { data?: any; error?: { code: string; message: string } } };
}

test('photo upload to hosted storage works end to end', async () => {
  const up = await apiJson(A.page, 'POST', '/uploads', { kind: 'photo', contentType: 'image/png', sizeBytes: PNG.length });
  expect(up.body.data?.signedUrl, JSON.stringify(up.body)).toBeTruthy();
  const put = await fetch(up.body.data.signedUrl, { method: 'PUT', headers: { 'content-type': 'image/png' }, body: PNG });
  expect(put.ok).toBe(true);
  const confirm = await apiJson(A.page, 'POST', '/profile/photos', { path: up.body.data.path });
  expect(confirm.status, JSON.stringify(confirm.body)).toBeLessThan(300);
  const { data: row } = await admin().from('profile_photos').select('moderation_status, storage_path').eq('profile_id', A.profileId).single();
  expect(row?.moderation_status).toBe('pending');
  // Owner can read it back through a signed URL issued by the API.
  const own = await apiJson(A.page, 'GET', '/profile');
  const url = JSON.stringify(own.body).match(/https:\/\/[^"]+profile-photos[^"]+/)?.[0];
  expect(url, 'signed photo URL in own profile').toBeTruthy();
  expect((await fetch(url!.replace(/\\u0026/g, '&'))).ok).toBe(true);
});

test('recommendations, explanation, interest and acceptance (SQL functions + RLS)', async () => {
  let recs: { profile: { id: string; displayName: string } }[] = [];
  await expect.poll(async () => {
    const r = await apiJson(A.page, 'GET', '/recommendations');
    recs = r.body.data ?? [];
    return recs.some((x) => x.profile.id === B.profileId);
  }, { timeout: 240_000, intervals: [5_000] }).toBe(true);

  const search = await apiJson(A.page, 'POST', '/search', { filters: { cities: ['Bengaluru'] }, sort: 'compatibility', limit: 20 });
  expect(search.status).toBe(200);
  expect(search.body.data.items.some((c: { id: string }) => c.id === B.profileId)).toBe(true);

  const ex = await apiJson(A.page, 'GET', `/profiles/${B.profileId}/explanation`);
  expect(ex.status).toBe(200);
  expect(ex.body.data.disclaimer).toMatch(/not a prediction/i);
  expect(ex.body.data.compatibility.mutual).toBeGreaterThan(0);

  const sent = await apiJson(A.page, 'POST', '/interests', { receiverProfileId: B.profileId, message: 'Would love to connect' });
  expect(sent.status, JSON.stringify(sent.body)).toBe(201);
  const received = await apiJson(B.page, 'GET', '/interests?direction=received&status=pending');
  const interest = (received.body.data ?? []).find((i: { profile: { id: string } }) => i.profile.id === A.profileId);
  expect(interest, 'B received A\'s interest').toBeTruthy();
  const accepted = await apiJson(B.page, 'POST', `/interests/${interest.id}`, { action: 'accept' });
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
  const { data: conn } = await admin().from('connections').select('status').or(`profile_a.eq.${A.profileId},profile_b.eq.${A.profileId}`).single();
  expect(conn?.status).toBe('active');
});

test('messaging delivers over hosted Realtime (RLS-scoped subscription)', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const { data: conv } = await admin().from('conversation_participants').select('conversation_id').eq('profile_id', B.profileId).single();
  const conversationId = conv!.conversation_id as string;

  // B subscribes with their own JWT (as the browser does); RLS must allow it.
  const bClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error: signErr } = await bClient.auth.signInWithPassword({ email: B.user.email, password: B.user.password });
  expect(signErr).toBeNull();
  const { data: sess } = await bClient.auth.getSession();
  await bClient.realtime.setAuth(sess.session!.access_token);
  const received: string[] = [];
  const subscribed = new Promise<void>((resolve, reject) => {
    bClient.channel(`hosted-test:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (p) => { received.push(String((p.new as { body: string }).body)); })
      .subscribe((status) => { if (status === 'SUBSCRIBED') resolve(); if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status)); });
  });
  await subscribed;

  const text = `Namaste from ${names.a}`;
  const sent = await apiJson(A.page, 'POST', `/conversations/${conversationId}/messages`, { clientId: `hosted-${suffix}-1`, kind: 'text', body: text });
  expect(sent.status, JSON.stringify(sent.body)).toBe(201);
  await expect.poll(() => received.includes(text), { timeout: 60_000 }).toBe(true);

  // Private presence/typing channel is authorised for participants.
  const room = await new Promise<string>((resolve) => {
    bClient.channel(`conversation:${conversationId}`, { config: { private: true } }).subscribe((status) => { if (status !== 'CLOSED') resolve(status); });
  });
  expect(room).toBe('SUBSCRIBED');

  // An outsider's JWT gets nothing from RLS-protected messages.
  const { data: leaked } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).from('messages').select('id').eq('conversation_id', conversationId);
  expect(leaked ?? []).toEqual([]);
  await bClient.removeAllChannels();
});

test('admin API and panel work against hosted data', async () => {
  await makeE2EAdmin(A.user.userId);
  const overview = await apiJson(A.page, 'GET', '/admin/overview');
  expect(overview.status, JSON.stringify(overview.body)).toBe(200);
  const users = await apiJson(A.page, 'GET', `/admin/users?q=${encodeURIComponent(names.b)}`);
  expect(users.status).toBe(200);
  expect(JSON.stringify(users.body)).toContain(names.b);
  await A.page.goto('/admin', { timeout: 180_000 });
  await expect(A.page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 180_000 });
});

test('no uncaught page errors', async () => {
  const errors = errorLogs.flat();
  expect(errors, errors.join('\n')).toEqual([]);
});
