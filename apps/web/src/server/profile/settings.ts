import 'server-only';
import {
  CONSENT_TYPES, NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS,
  type ConsentState, type ConsentType, type DeviceItem, type NotificationCategory, type NotificationChannel,
} from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { getSetting } from '@/server/config';
import { errors } from '@/server/http';
import { DEFAULTS as NOTIFY_DEFAULTS, notify } from '@/server/notify';

// Account -------------------------------------------------------------------
export async function updateAccount(auth: AuthContext, input: { fullName?: string | null; preferredLocale?: string }) {
  const patch: { full_name?: string | null; preferred_locale?: string } = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.preferredLocale) patch.preferred_locale = input.preferredLocale;
  if (!Object.keys(patch).length) return { ok: true };
  const { error } = await db().from('app_users').update(patch).eq('id', auth.userId);
  if (error) throw error;
  await audit(auth, { action: 'account.update', entityType: 'app_user', entityId: auth.userId, after: patch });
  return { ok: true };
}

// Notifications ---------------------------------------------------------------
export async function getNotificationPreferences(auth: AuthContext) {
  const { data } = await db().from('notification_preferences').select('category, channel, enabled').eq('user_id', auth.userId);
  const stored = new Map((data ?? []).map((r) => [`${r.category}:${r.channel}`, r.enabled]));
  return NOTIFICATION_CATEGORIES.flatMap((category) =>
    NOTIFICATION_CHANNELS.map((channel) => ({
      category,
      channel,
      enabled: stored.get(`${category}:${channel}`) ?? (channel === 'in_app' ? true : (NOTIFY_DEFAULTS[category] as string[]).includes(channel)),
      locked: channel === 'in_app' && category === 'security',
    })),
  );
}

export async function setNotificationPreferences(auth: AuthContext, prefs: { category: NotificationCategory; channel: NotificationChannel; enabled: boolean }[]) {
  const rows = prefs
    .filter((p) => !(p.category === 'security' && p.channel === 'in_app'))
    .map((p) => ({ user_id: auth.userId, category: p.category, channel: p.channel, enabled: p.enabled, updated_at: new Date().toISOString() }));
  if (rows.length) {
    const { error } = await db().from('notification_preferences').upsert(rows, { onConflict: 'user_id,category,channel' });
    if (error) throw error;
  }
  return getNotificationPreferences(auth);
}

// Consents --------------------------------------------------------------------
const REQUIRED: ConsentType[] = ['terms', 'privacy'];
export async function getConsents(auth: AuthContext): Promise<ConsentState[]> {
  const { data } = await db().from('current_consents').select('consent_type, granted, policy_version, created_at').eq('user_id', auth.userId);
  const by = new Map((data ?? []).map((r) => [r.consent_type, r]));
  return CONSENT_TYPES.map((t) => {
    const r = by.get(t);
    return { consentType: t, granted: r?.granted ?? false, policyVersion: r?.policy_version ?? null, updatedAt: r?.created_at ?? null, required: REQUIRED.includes(t) };
  });
}

export async function setConsent(auth: AuthContext, consentType: ConsentType, granted: boolean) {
  if (REQUIRED.includes(consentType) && !granted) {
    throw errors.validation('Terms and Privacy consent are needed to use the service. To withdraw them, delete your account from Settings → Data.');
  }
  const policy = await getSetting<Record<string, string>>('policy_versions', {});
  const { error } = await db().from('consent_records').insert({
    user_id: auth.userId,
    consent_type: consentType,
    granted,
    policy_version: policy[consentType] ?? policy.privacy ?? 'unversioned',
    source: auth.platform,
    ip: auth.ip,
    user_agent: auth.userAgent,
  });
  if (error) throw error;
  await audit(auth, { action: granted ? 'consent.grant' : 'consent.revoke', entityType: 'consent', entityId: consentType });
  return getConsents(auth);
}

// Devices ---------------------------------------------------------------------
export async function listDevices(auth: AuthContext): Promise<DeviceItem[]> {
  const { data } = await db().from('user_devices').select('*').eq('user_id', auth.userId).is('revoked_at', null).order('last_seen_at', { ascending: false });
  return (data ?? []).map((d) => ({ id: d.id, platform: d.platform as DeviceItem['platform'], deviceName: d.device_name, hasPush: !!d.push_token, appVersion: d.app_version, lastSeenAt: d.last_seen_at, createdAt: d.created_at }));
}

export async function registerDevice(auth: AuthContext, input: { platform: 'web' | 'ios' | 'android'; deviceName?: string | null; pushToken?: string | null; pushProvider?: string | null; appVersion?: string | null }) {
  const c = db();
  const now = new Date().toISOString();
  let existingId: string | null = null;
  if (input.pushToken) {
    // A push token identifies one physical device; move it to this user if needed.
    const { data } = await c.from('user_devices').select('id, user_id').eq('push_token', input.pushToken);
    for (const d of data ?? []) {
      if (d.user_id === auth.userId) existingId = d.id;
      else await c.from('user_devices').update({ push_token: null, revoked_at: now }).eq('id', d.id);
    }
  } else {
    const q = c.from('user_devices').select('id').eq('user_id', auth.userId).eq('platform', input.platform).is('revoked_at', null);
    const { data } = input.deviceName ? await q.eq('device_name', input.deviceName).limit(1) : await q.is('device_name', null).limit(1);
    existingId = data?.[0]?.id ?? null;
  }
  const fields = { platform: input.platform, device_name: input.deviceName ?? null, push_token: input.pushToken ?? null, push_provider: input.pushProvider ?? null, app_version: input.appVersion ?? null, last_seen_at: now, revoked_at: null };
  if (existingId) {
    await c.from('user_devices').update(fields).eq('id', existingId);
    return { id: existingId, created: false };
  }
  const { count } = await c.from('user_devices').select('id', { count: 'exact', head: true }).eq('user_id', auth.userId);
  const { data, error } = await c.from('user_devices').insert({ user_id: auth.userId, ...fields }).select('id').single();
  if (error) throw error;
  if ((count ?? 0) > 0) {
    await notify({ userId: auth.userId, category: 'security', templateKey: 'security_new_device', vars: { device: input.deviceName ?? input.platform }, data: { href: '/app/settings?tab=devices' } });
  }
  return { id: data.id, created: true };
}

export async function revokeDevice(auth: AuthContext, id: string) {
  const { data } = await db().from('user_devices').update({ revoked_at: new Date().toISOString(), push_token: null }).eq('id', id).eq('user_id', auth.userId).select('id');
  if (!data?.length) throw errors.notFound('Device not found.');
  await audit(auth, { action: 'device.revoke', entityType: 'user_device', entityId: id });
  return { ok: true };
}
