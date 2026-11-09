import { setUsage } from './quota-helpers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConnectionItem, InterestItem, SendInterestResult } from '@2k/shared';
import { GET as listInterests, POST as sendInterest } from '@/app/api/v1/interests/route';
import { POST as respond } from '@/app/api/v1/interests/[id]/route';
import { GET as listConnections } from '@/app/api/v1/connections/route';
import { POST as closeConnection } from '@/app/api/v1/connections/[id]/close/route';
import { expireInterests } from '@/server/interests/lifecycle';
import { admin, call, request } from './helpers';
import { deleteUsers, seedMember, type SeededMember } from './discovery.fixtures';

let a: SeededMember, b: SeededMember, c: SeededMember, d: SeededMember, e: SeededMember, f: SeededMember, g: SeededMember, sameGender: SeededMember;

beforeAll(async () => {
  [a, b, c, d, e, f, g, sameGender] = await Promise.all([
    seedMember({ label: 'int-a', gender: 'female', seeking: 'male' }),
    seedMember({ label: 'int-b', gender: 'male', seeking: 'female' }),
    seedMember({ label: 'int-c', gender: 'male', seeking: 'female' }),
    seedMember({ label: 'int-d', gender: 'male', seeking: 'female' }),
    seedMember({ label: 'int-e', gender: 'male', seeking: 'female' }),
    seedMember({ label: 'int-f', gender: 'male', seeking: 'female' }),
    seedMember({ label: 'int-g', gender: 'male', seeking: 'female' }),
    seedMember({ label: 'int-same', gender: 'female', seeking: 'male' }),
  ]);
});
afterAll(() => deleteUsers([a, b, c, d, e, f, g, sameGender]));

const send = (from: SeededMember, to: SeededMember, message?: string) =>
  call<SendInterestResult>(sendInterest, request('/api/v1/interests', { token: from.token, body: { receiverProfileId: to.profileId, message } }));

describe('interest lifecycle', () => {
  let interestId: string;

  it('sends an interest and notifies the receiver', async () => {
    const r = await send(a, b, 'Hello, I liked your profile.');
    expect(r.status).toBe(201);
    expect(r.body.data!.status).toBe('pending');
    interestId = r.body.data!.interestId;
    const { data: n } = await admin().from('notifications').select('type, data').eq('user_id', b.userId).eq('type', 'interest_received');
    expect(n?.length).toBe(1);
  });

  it('rejects duplicates and self-interest', async () => {
    expect((await send(a, b)).status).toBe(409);
    expect((await send(a, a)).status).toBe(422);
  });

  it('respects the receiver\'s gender preference', async () => {
    const r = await send(sameGender, a);
    expect(r.status).toBe(403);
  });

  it('lists received interests with the sender card', async () => {
    const r = await call<InterestItem[]>(listInterests, request('/api/v1/interests?direction=received', { token: b.token }));
    const item = r.body.data!.find((i) => i.id === interestId)!;
    expect(item.direction).toBe('received');
    expect(item.profile.id).toBe(a.profileId);
    expect(item.message).toContain('liked');
  });

  it('only the receiver can accept; accepting creates connection, conversation and greeting', async () => {
    expect((await call(respond, request(`/api/v1/interests/${interestId}`, { token: a.token, body: { action: 'accept' } }), { id: interestId })).status).toBe(403);
    const r = await call<{ status: string; connectionId: string; conversationId: string }>(respond, request(`/api/v1/interests/${interestId}`, { token: b.token, body: { action: 'accept' } }), { id: interestId });
    expect(r.status).toBe(200);
    expect(r.body.data!.status).toBe('accepted');
    const { data: parts } = await admin().from('conversation_participants').select('profile_id').eq('conversation_id', r.body.data!.conversationId);
    expect(parts?.map((p) => p.profile_id).sort()).toEqual([a.profileId, b.profileId].sort());
    const { data: sys } = await admin().from('messages').select('kind').eq('conversation_id', r.body.data!.conversationId);
    expect(sys?.[0]?.kind).toBe('system');
    const { data: n } = await admin().from('notifications').select('type').eq('user_id', a.userId).eq('type', 'interest_accepted');
    expect(n?.length).toBe(1);
    const conns = await call<ConnectionItem[]>(listConnections, request('/api/v1/connections', { token: a.token }));
    expect(conns.body.data!.find((x) => x.profile.id === b.profileId)?.conversationId).toBe(r.body.data!.conversationId);
    // already connected → cannot send again
    expect((await send(a, b)).status).toBe(409);
    expect((await call(respond, request(`/api/v1/interests/${interestId}`, { token: b.token, body: { action: 'decline' } }), { id: interestId })).status).toBe(409);
  });

  it('closing a connection locks the conversation', async () => {
    const conns = await call<ConnectionItem[]>(listConnections, request('/api/v1/connections', { token: a.token }));
    const conn = conns.body.data!.find((x) => x.profile.id === b.profileId)!;
    const r = await call(closeConnection, request(`/api/v1/connections/${conn.id}/close`, { token: a.token, body: { reason: 'Not the right fit' } }), { id: conn.id });
    expect(r.status).toBe(200);
    const { data: conv } = await admin().from('conversations').select('is_locked').eq('connection_id', conn.id).single();
    expect(conv?.is_locked).toBe(true);
    const active = await call<ConnectionItem[]>(listConnections, request('/api/v1/connections', { token: a.token }));
    expect(active.body.data!.some((x) => x.id === conn.id)).toBe(false);
  });
});

describe('mutual and other responses', () => {
  it('sending back to someone who already sent you an interest auto-accepts', async () => {
    expect((await send(c, a)).status).toBe(201);
    const r = await send(a, c);
    expect(r.status).toBe(201);
    expect(r.body.data!.autoAccepted).toBe(true);
    expect(r.body.data!.connectionId).toBeTruthy();
  });

  it('withdraw (sender only) and decline (receiver only)', async () => {
    const w = await send(a, d);
    const id = w.body.data!.interestId;
    expect((await call(respond, request(`/api/v1/interests/${id}`, { token: d.token, body: { action: 'withdraw' } }), { id })).status).toBe(403);
    const ok = await call<{ status: string }>(respond, request(`/api/v1/interests/${id}`, { token: a.token, body: { action: 'withdraw' } }), { id });
    expect(ok.body.data!.status).toBe('withdrawn');

    const s = await send(e, a);
    const id2 = s.body.data!.interestId;
    const dec = await call<{ status: string }>(respond, request(`/api/v1/interests/${id2}`, { token: a.token, body: { action: 'decline' } }), { id: id2 });
    expect(dec.body.data!.status).toBe('declined');
  });

  it('still enforces the anti-abuse daily interest cap (50 for everyone)', async () => {
    // Pre-fill today's usage just under the cap (everything is free; caps remain for safety).
    await setUsage(a.userId, 'interests', 49);
    expect((await send(a, f)).status).toBe(201);
    const r = await send(a, g);
    expect(r.status).toBe(402);
    expect(r.body.error?.code).toBe('entitlement_required');
  });

  it('expires stale pending interests', async () => {
    const s = await send(g, a);
    const id = s.body.data!.interestId;
    await admin().from('interests').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', id);
    expect(await expireInterests()).toBeGreaterThanOrEqual(1);
    const { data } = await admin().from('interests').select('status').eq('id', id).single();
    expect(data?.status).toBe('expired');
  });
});
