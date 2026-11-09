import 'server-only';
import type { Json, NotificationCategory } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { providers } from './providers';
import type { DeliveryChannel, DeliveryTarget, RenderedMessage } from './types';

/** Default channel opt-ins when a member has not set preferences. */
export const DEFAULTS: Record<NotificationCategory, DeliveryChannel[]> = {
  interests: ['push', 'email'],
  connections: ['push', 'email'],
  messages: ['push'],
  recommendations: ['push'],
  verification: ['email', 'push'],
  billing: ['email'],
  family: ['email', 'push'],
  product_updates: [],
  security: ['email', 'push'],
};

export function renderTemplate(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])));
}

export interface NotifyInput {
  userId: string;
  category: NotificationCategory;
  templateKey: string;
  vars?: Record<string, unknown>;
  /** Deep-link payload for clients, e.g. { href: '/app/interests' } */
  data?: Record<string, unknown>;
  /** Skip in-app record (e.g. message pushes that already show in chat). */
  skipInApp?: boolean;
  /** Force-send on these channels regardless of preferences (security/legal only). */
  forceChannels?: DeliveryChannel[];
}

/**
 * Create an in-app notification and fan out to external channels according to
 * the member's preferences and which providers are configured. Never throws.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const c = db();
    const vars = input.vars ?? {};
    const [{ data: user }, { data: templates }, { data: prefs }, { data: devices }] = await Promise.all([
      c.from('app_users').select('id, email, phone, full_name, preferred_locale, status').eq('id', input.userId).maybeSingle(),
      c.from('notification_templates').select('channel, locale, subject, body, provider_template_id').eq('key', input.templateKey).eq('is_active', true),
      c.from('notification_preferences').select('channel, enabled').eq('user_id', input.userId).eq('category', input.category),
      c.from('user_devices').select('push_token').eq('user_id', input.userId).is('revoked_at', null).not('push_token', 'is', null),
    ]);
    if (!user || user.status === 'deleted') return;
    const locale = user.preferred_locale ?? 'en';
    const allVars = { name: user.full_name ?? 'there', ...vars };
    const pick = (channel: string) =>
      templates?.find((t) => t.channel === channel && t.locale === locale) ?? templates?.find((t) => t.channel === channel && t.locale === 'en');

    let notificationId: string | null = null;
    const inApp = pick('in_app') ?? pick('push');
    if (!input.skipInApp && inApp) {
      const { data: row } = await c
        .from('notifications')
        .insert({
          user_id: input.userId,
          type: input.templateKey,
          title: renderTemplate(inApp.subject ?? inApp.body, allVars).slice(0, 200),
          body: inApp.subject ? renderTemplate(inApp.body, allVars) : null,
          data: (input.data ?? {}) as NonNullable<Json>,
        })
        .select('id')
        .single();
      notificationId = row?.id ?? null;
    }

    const prefMap = new Map((prefs ?? []).map((p) => [p.channel, p.enabled]));
    const target: DeliveryTarget = {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      pushTokens: (devices ?? []).map((d) => d.push_token!).filter(Boolean),
      locale,
    };

    const channels: DeliveryChannel[] = ['email', 'sms', 'push', 'whatsapp'];
    await Promise.all(
      channels.map(async (channel) => {
        const tpl = pick(channel);
        if (!tpl) return;
        const forced = input.forceChannels?.includes(channel) ?? false;
        const wanted = forced || (prefMap.get(channel) ?? DEFAULTS[input.category].includes(channel));
        if (!wanted) return;
        const provider = providers[channel];
        const message: RenderedMessage = {
          subject: tpl.subject ? renderTemplate(tpl.subject, allVars) : null,
          body: renderTemplate(tpl.body, allVars),
          templateKey: input.templateKey,
          providerTemplateId: tpl.provider_template_id,
          data: input.data ?? {},
        };
        const result = provider.isConfigured()
          ? await provider.send(target, message).catch((e: unknown) => ({ status: 'failed' as const, provider: provider.name, error: e instanceof Error ? e.message : 'error' }))
          : { status: 'skipped_unconfigured' as const, provider: provider.name };
        await c.from('notification_deliveries').insert({
          notification_id: notificationId,
          user_id: input.userId,
          channel,
          template_key: input.templateKey,
          status: result.status,
          provider: result.provider,
          provider_message_id: 'providerMessageId' in result ? result.providerMessageId ?? null : null,
          error: 'error' in result ? result.error ?? null : null,
        });
      }),
    );
  } catch (err) {
    console.error('[notify] failed', input.templateKey, err);
  }
}
