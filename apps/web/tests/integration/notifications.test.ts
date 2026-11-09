import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NotificationItem } from '@2k/shared';
import { GET as list } from '@/app/api/v1/notifications/route';
import { POST as read } from '@/app/api/v1/notifications/read/route';
import { admin, call, createTestUser, request, type TestUser } from './helpers';

let u: TestUser, other: TestUser;
beforeAll(async () => {
  [u, other] = await Promise.all([createTestUser('notif'), createTestUser('notif-other')]);
  const rows = Array.from({ length: 5 }, (_, i) => ({ user_id: u.userId, type: 'test', title: `Note ${i}`, created_at: new Date(Date.now() - i * 1000).toISOString() }));
  const { error } = await admin().from('notifications').insert([...rows, { user_id: other.userId, type: 'test', title: 'Not yours', created_at: new Date().toISOString() }]);
  if (error) throw error;
});
afterAll(async () => { for (const x of [u, other]) await admin().auth.admin.deleteUser(x.userId); });

describe('notifications', () => {
  it('paginates own notifications newest first', async () => {
    const p1 = await call<NotificationItem[]>(list, request('/api/v1/notifications?limit=3', { token: u.token }));
    expect(p1.body.data!.map((n) => n.title)).toEqual(['Note 0', 'Note 1', 'Note 2']);
    expect(p1.body.nextCursor).toBeTruthy();
    const p2 = await call<NotificationItem[]>(list, request(`/api/v1/notifications?limit=3&cursor=${p1.body.nextCursor}`, { token: u.token }));
    expect(p2.body.data!.map((n) => n.title)).toEqual(['Note 3', 'Note 4']);
  });

  it('marks one, then all, as read — never another user\'s', async () => {
    const all = (await call<NotificationItem[]>(list, request('/api/v1/notifications', { token: u.token }))).body.data!;
    const one = await call<{ updated: number }>(read, request('/api/v1/notifications/read', { token: u.token, body: { ids: [all[0]!.id] } }));
    expect(one.body.data!.updated).toBe(1);
    const unread = await call<NotificationItem[]>(list, request('/api/v1/notifications?unread=1', { token: u.token }));
    expect(unread.body.data!.length).toBe(4);
    const rest = await call<{ updated: number }>(read, request('/api/v1/notifications/read', { token: u.token, body: {} }));
    expect(rest.body.data!.updated).toBe(4);
    const { data } = await admin().from('notifications').select('read_at').eq('user_id', other.userId);
    expect(data?.[0]?.read_at).toBeNull();
  });
});
