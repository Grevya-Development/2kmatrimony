import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emailProvider } from '@/server/notify/providers/email';
import { smsProvider } from '@/server/notify/providers/sms';
import { pushProvider } from '@/server/notify/providers/push';
import { whatsappProvider } from '@/server/notify/providers/whatsapp';
import type { DeliveryTarget, RenderedMessage } from '@/server/notify/types';
import { admin, createTestUser, type TestUser } from './helpers';

const msg: RenderedMessage = { subject: 'New interest', body: 'Hello Asha,\\n\\nRavi expressed interest.\\n\\nhttps://app.example.com/app/interests', templateKey: 'interest_received', providerTemplateId: 'tpl_123', data: { href: '/app/interests' } };
const target = (u: TestUser, extra: Partial<DeliveryTarget> = {}): DeliveryTarget => ({ userId: u.userId, email: u.email, phone: '+919876543210', pushTokens: [], locale: 'en', ...extra });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FetchMock = ReturnType<typeof vi.fn<(url: string, init: any) => Promise<Response>>>;
let fetchMock: FetchMock;
const realFetch = globalThis.fetch;
let user: TestUser;
const ENV = ['RESEND_API_KEY', 'MSG91_AUTH_KEY', 'MSG91_SENDER_ID', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'];

beforeEach(async () => {
  user ??= await createTestUser('providers');
  fetchMock = vi.fn<(url: string, init: any) => Promise<Response>>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  // Only intercept third-party hosts; Supabase calls pass through.
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (/resend\.com|msg91\.com|exp\.host|graph\.facebook\.com/.test(url)) return fetchMock(url, init);
    return realFetch(input, init);
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; for (const k of ENV) delete process.env[k]; });
afterAll(async () => { if (user) await admin().auth.admin.deleteUser(user.userId); });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('email (Resend)', () => {
  it('is unconfigured without an API key', () => expect(emailProvider.isConfigured()).toBe(false));
  it('sends HTML + text with real newlines and linkified URLs', async () => {
    process.env.RESEND_API_KEY = 're_test';
    fetchMock.mockResolvedValue(json({ id: 'email_1' }));
    const r = await emailProvider.send(target(user), msg);
    expect(r).toMatchObject({ status: 'sent', providerMessageId: 'email_1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body);
    expect(body.to).toEqual([user.email]);
    expect(body.text).toContain('Hello Asha,\n\nRavi');
    expect(body.html).toContain('<a href="https://app.example.com/app/interests"');
  });
  it('reports API errors as failed', async () => {
    process.env.RESEND_API_KEY = 're_test';
    fetchMock.mockResolvedValue(json({ message: 'invalid from' }, 422));
    expect(await emailProvider.send(target(user), msg)).toMatchObject({ status: 'failed', error: '422 invalid from' });
  });
});

describe('sms (MSG91)', () => {
  it('requires a DLT template id', async () => {
    process.env.MSG91_AUTH_KEY = 'k'; process.env.MSG91_SENDER_ID = 'TWOKMT';
    const r = await smsProvider.send(target(user), { ...msg, providerTemplateId: null });
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/DLT template/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('calls the flow API with the template and India MSISDN', async () => {
    process.env.MSG91_AUTH_KEY = 'k'; process.env.MSG91_SENDER_ID = 'TWOKMT';
    fetchMock.mockResolvedValue(json({ type: 'success', message: 'req_1' }));
    const r = await smsProvider.send(target(user, { phone: '9876543210' }), msg);
    expect(r.status).toBe('sent');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://control.msg91.com/api/v5/flow');
    expect(init.headers.authkey).toBe('k');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ template_id: 'tpl_123', sender: 'TWOKMT' });
    expect(body.recipients[0].mobiles).toBe('919876543210');
  });
});

describe('push (Expo)', () => {
  it('sends to valid Expo tokens and revokes DeviceNotRegistered tokens', async () => {
    const good = 'ExponentPushToken[good]';
    const dead = 'ExponentPushToken[dead]';
    await admin().from('user_devices').insert([
      { user_id: user.userId, platform: 'ios', push_token: good, push_provider: 'expo' },
      { user_id: user.userId, platform: 'android', push_token: dead, push_provider: 'expo' },
    ]);
    fetchMock.mockResolvedValue(json({ data: [{ status: 'ok', id: 'tkt_1' }, { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }] }));
    const r = await pushProvider.send(target(user, { pushTokens: [good, dead, 'not-a-token'] }), msg);
    expect(r).toMatchObject({ status: 'sent', providerMessageId: 'tkt_1' });
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ to: good, title: 'New interest', data: { href: '/app/interests' } });
    const { data: devices } = await admin().from('user_devices').select('push_token').eq('user_id', user.userId);
    expect(devices!.map((d) => d.push_token).sort()).toEqual([good, null].sort());
  });
  it('fails without tokens', async () => {
    expect((await pushProvider.send(target(user), msg)).status).toBe('failed');
  });
});

describe('whatsapp (Meta Cloud API)', () => {
  it('skips unless the flag is on and the member consented', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123'; process.env.WHATSAPP_ACCESS_TOKEN = 'tok';
    const r = await whatsappProvider.send(target(user), msg);
    expect(r.status).toBe('skipped_unconfigured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sends an approved template when flag + consent are present', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123'; process.env.WHATSAPP_ACCESS_TOKEN = 'tok';
    const { data: before } = await admin().from('feature_flags').select('enabled').eq('key', 'whatsapp_notifications').single();
    await admin().from('feature_flags').update({ enabled: true }).eq('key', 'whatsapp_notifications');
    await admin().from('consent_records').insert({ user_id: user.userId, consent_type: 'whatsapp', policy_version: 'test', granted: true });
    try {
      fetchMock.mockResolvedValue(json({ messages: [{ id: 'wamid.1' }] }));
      const r = await whatsappProvider.send(target(user), msg);
      expect(r).toMatchObject({ status: 'sent', providerMessageId: 'wamid.1' });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toMatch(/graph\.facebook\.com\/v\d+\.\d+\/123\/messages$/);
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({ messaging_product: 'whatsapp', to: '919876543210', type: 'template', template: { name: 'tpl_123' } });
    } finally {
      await admin().from('feature_flags').update({ enabled: before!.enabled }).eq('key', 'whatsapp_notifications');
    }
  });
});
