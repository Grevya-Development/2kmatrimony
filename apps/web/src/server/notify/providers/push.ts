import { db } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import type { ChannelProvider } from '../types';
import { toPlainText } from './format';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoTicket { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } }

/** Expo push service (works for iOS + Android Expo apps). Revokes unregistered tokens. */
export const pushProvider: ChannelProvider = {
  channel: 'push',
  name: 'expo',
  isConfigured: () => true,
  async send(target, message) {
    const tokens = target.pushTokens.filter((t) => /^Expo(nent)?PushToken\[.+\]$/.test(t));
    if (tokens.length === 0) return { status: 'failed', provider: 'expo', error: 'no_push_tokens' };
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
    if (serverEnv.expoAccessToken) headers.authorization = `Bearer ${serverEnv.expoAccessToken}`;
    const title = message.subject ?? '2K Matrimony';
    const ids: string[] = [];
    const errorsSeen: string[] = [];
    for (let i = 0; i < tokens.length; i += 100) {
      const chunk = tokens.slice(i, i + 100);
      const res = await fetch(EXPO_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk.map((to) => ({ to, title, body: toPlainText(message.body).slice(0, 180), data: message.data, sound: 'default', channelId: 'default' }))),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: ExpoTicket[]; errors?: { message: string }[] };
      if (!res.ok) { errorsSeen.push(`${res.status} ${json.errors?.[0]?.message ?? ''}`.trim()); continue; }
      const dead: string[] = [];
      (json.data ?? []).forEach((t, idx) => {
        if (t.status === 'ok' && t.id) ids.push(t.id);
        else {
          errorsSeen.push(t.details?.error ?? t.message ?? 'error');
          if (t.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx]!);
        }
      });
      if (dead.length) await db().from('user_devices').update({ push_token: null }).eq('user_id', target.userId).in('push_token', dead);
    }
    if (ids.length === 0) return { status: 'failed', provider: 'expo', error: errorsSeen.join('; ').slice(0, 300) || 'push failed' };
    return { status: 'sent', provider: 'expo', providerMessageId: ids.join(','), error: errorsSeen.length ? errorsSeen.join('; ').slice(0, 300) : null };
  },
};
