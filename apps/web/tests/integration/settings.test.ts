import { afterAll, describe, expect, it } from 'vitest';
import type { ConsentState, DeviceItem } from '@2k/shared';
import { admin, call, request } from './helpers';
import { cleanupCreated, newUser } from './profile-helpers';
import { PATCH as patchAccount } from '@/app/api/v1/account/route';
import { GET as getNotif, PUT as putNotif } from '@/app/api/v1/settings/notifications/route';
import { GET as getConsents, POST as postConsent } from '@/app/api/v1/settings/consents/route';
import { GET as getDevices, POST as postDevice } from '@/app/api/v1/devices/route';
import { DELETE as deleteDevice } from '@/app/api/v1/devices/[id]/route';

afterAll(cleanupCreated);

describe('settings', () => {
  it('updates account name and locale', async () => {
    const u = await newUser('a-acct');
    const r = await call(patchAccount, request('/api/v1/account', { token: u.token, method: 'PATCH', body: { fullName: 'Ravi Kumar', preferredLocale: 'ta' } }));
    expect(r.status).toBe(200);
    const { data } = await admin().from('app_users').select('full_name, preferred_locale').eq('id', u.userId).single();
    expect(data).toEqual({ full_name: 'Ravi Kumar', preferred_locale: 'ta' });
  });

  it('returns defaults and persists notification preferences', async () => {
    const u = await newUser('a-notif');
    const r = await call<{ category: string; channel: string; enabled: boolean }[]>(getNotif, request('/api/v1/settings/notifications', { token: u.token }));
    expect(r.body.data!.find((p) => p.category === 'interests' && p.channel === 'email')?.enabled).toBe(true);
    expect(r.body.data!.find((p) => p.category === 'product_updates' && p.channel === 'email')?.enabled).toBe(false);
    const put = await call<{ category: string; channel: string; enabled: boolean }[]>(putNotif, request('/api/v1/settings/notifications', { token: u.token, method: 'PUT', body: { preferences: [{ category: 'interests', channel: 'email', enabled: false }] } }));
    expect(put.body.data!.find((p) => p.category === 'interests' && p.channel === 'email')?.enabled).toBe(false);
  });

  it('allows revoking optional consents but not terms/privacy', async () => {
    const u = await newUser('a-cons');
    const bad = await call(postConsent, request('/api/v1/settings/consents', { token: u.token, body: { consentType: 'terms', granted: false } }));
    expect(bad.status).toBe(422);
    await call(postConsent, request('/api/v1/settings/consents', { token: u.token, body: { consentType: 'ai_processing', granted: true } }));
    const r = await call<ConsentState[]>(postConsent, request('/api/v1/settings/consents', { token: u.token, body: { consentType: 'ai_processing', granted: false } }));
    expect(r.body.data!.find((c) => c.consentType === 'ai_processing')?.granted).toBe(false);
    const list = await call<ConsentState[]>(getConsents, request('/api/v1/settings/consents', { token: u.token }));
    expect(list.body.data!.find((c) => c.consentType === 'terms')?.required).toBe(true);
  });

  it('registers, deduplicates, moves push tokens and revokes devices', async () => {
    const a = await newUser('a-dev-a');
    const b = await newUser('a-dev-b');
    const token = `ExponentPushToken[${Math.random().toString(36).slice(2)}]`;
    const r1 = await call<{ id: string; created: boolean }>(postDevice, request('/api/v1/devices', { token: a.token, body: { platform: 'ios', deviceName: 'iPhone', pushToken: token, pushProvider: 'expo' } }));
    expect(r1.body.data!.created).toBe(true);
    const r2 = await call<{ id: string; created: boolean }>(postDevice, request('/api/v1/devices', { token: a.token, body: { platform: 'ios', deviceName: 'iPhone', pushToken: token, pushProvider: 'expo' } }));
    expect(r2.body.data!.id).toBe(r1.body.data!.id);
    // Same physical device signs into another account: token moves.
    await call(postDevice, request('/api/v1/devices', { token: b.token, body: { platform: 'ios', deviceName: 'iPhone', pushToken: token, pushProvider: 'expo' } }));
    const listA = await call<DeviceItem[]>(getDevices, request('/api/v1/devices', { token: a.token }));
    expect(listA.body.data!.length).toBe(0);
    const listB = await call<DeviceItem[]>(getDevices, request('/api/v1/devices', { token: b.token }));
    expect(listB.body.data![0]?.hasPush).toBe(true);
    const del = await call(deleteDevice, request(`/api/v1/devices/${listB.body.data![0]!.id}`, { token: b.token, method: 'DELETE' }), { id: listB.body.data![0]!.id });
    expect(del.status).toBe(200);
    const other = await call(deleteDevice, request(`/api/v1/devices/${listB.body.data![0]!.id}`, { token: a.token, method: 'DELETE' }), { id: listB.body.data![0]!.id });
    expect(other.status).toBe(404);
  });
});
