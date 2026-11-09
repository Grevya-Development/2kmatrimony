import { integrations, serverEnv } from '@/lib/env';
import type { ChannelProvider } from '../types';
import { msisdn, toPlainText } from './format';

/**
 * MSG91 Flow API (DLT-compliant). Each SMS template row must carry the MSG91
 * flow/template id in notification_templates.provider_template_id; the flow
 * should expose a variable named `body` (or map ##body## in MSG91).
 */
export const smsProvider: ChannelProvider = {
  channel: 'sms',
  name: 'msg91',
  isConfigured: () => integrations.sms,
  async send(target, message) {
    if (!target.phone) return { status: 'failed', provider: 'msg91', error: 'no_phone_number' };
    if (!message.providerTemplateId) return { status: 'failed', provider: 'msg91', error: `missing DLT template id for ${message.templateKey}` };
    const res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: { authkey: serverEnv.msg91AuthKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        template_id: message.providerTemplateId,
        sender: serverEnv.msg91SenderId,
        short_url: '0',
        recipients: [{ mobiles: msisdn(target.phone), body: toPlainText(message.body).slice(0, 300) }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!res.ok || json.type === 'error') return { status: 'failed', provider: 'msg91', error: `${res.status} ${json.message ?? ''}`.trim() };
    return { status: 'sent', provider: 'msg91', providerMessageId: json.message ?? null };
  },
};
