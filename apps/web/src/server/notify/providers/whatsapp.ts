import { db } from '@/lib/supabase/admin';
import { integrations, serverEnv } from '@/lib/env';
import type { ChannelProvider } from '../types';
import { msisdn, toPlainText } from './format';

const GRAPH_VERSION = 'v21.0';

/**
 * Meta WhatsApp Cloud API with pre-approved templates (provider_template_id =
 * template name; template must have one body variable {{1}}). Sends only when
 * the `whatsapp_notifications` flag is on AND the member granted 'whatsapp' consent.
 */
export const whatsappProvider: ChannelProvider = {
  channel: 'whatsapp',
  name: 'meta_cloud',
  isConfigured: () => integrations.whatsapp,
  async send(target, message) {
    const [{ data: flag }, { data: consent }] = await Promise.all([
      db().from('feature_flags').select('enabled').eq('key', 'whatsapp_notifications').maybeSingle(),
      db().from('current_consents').select('granted').eq('user_id', target.userId).eq('consent_type', 'whatsapp').maybeSingle(),
    ]);
    if (!flag?.enabled) return { status: 'skipped_unconfigured', provider: 'meta_cloud', error: 'whatsapp_notifications flag is off' };
    if (!consent?.granted) return { status: 'skipped_unconfigured', provider: 'meta_cloud', error: 'member has not granted WhatsApp consent' };
    if (!target.phone) return { status: 'failed', provider: 'meta_cloud', error: 'no_phone_number' };
    if (!message.providerTemplateId) return { status: 'failed', provider: 'meta_cloud', error: `missing approved template name for ${message.templateKey}` };

    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${serverEnv.whatsappPhoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${serverEnv.whatsappAccessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msisdn(target.phone),
        type: 'template',
        template: {
          name: message.providerTemplateId,
          language: { code: target.locale === 'en' ? 'en' : target.locale },
          components: [{ type: 'body', parameters: [{ type: 'text', text: toPlainText(message.body).slice(0, 1000) }] }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) return { status: 'failed', provider: 'meta_cloud', error: `${res.status} ${json.error?.message ?? ''}`.trim() };
    return { status: 'sent', provider: 'meta_cloud', providerMessageId: json.messages?.[0]?.id ?? null };
  },
};
