import { integrations, serverEnv } from '@/lib/env';
import type { ChannelProvider } from '../types';
import { toEmailHtml, toPlainText } from './format';

/** Reserved / non-deliverable TLDs (RFC 2606/6761): never attempt delivery (protects sender reputation). */
const UNDELIVERABLE = /[.@](test|example|invalid|localhost)$/i;
export const isUndeliverableAddress = (email: string): boolean => UNDELIVERABLE.test(email.trim());

/** Resend transactional email. */
export const emailProvider: ChannelProvider = {
  channel: 'email',
  name: 'resend',
  isConfigured: () => integrations.email,
  async send(target, message) {
    if (!target.email) return { status: 'failed', provider: 'resend', error: 'no_email_address' };
    if (isUndeliverableAddress(target.email)) return { status: 'failed', provider: 'resend', error: 'undeliverable_test_address' };
    const subject = message.subject ?? '2K Marriage';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${serverEnv.resendApiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: serverEnv.emailFrom,
        to: [target.email],
        subject,
        html: toEmailHtml(subject, message.body),
        text: toPlainText(message.body),
        tags: [{ name: 'template', value: message.templateKey.replace(/[^a-zA-Z0-9_-]/g, '_') }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { status: 'failed', provider: 'resend', error: `${res.status} ${json.message ?? ''}`.trim() };
    return { status: 'sent', provider: 'resend', providerMessageId: json.id ?? null };
  },
};
