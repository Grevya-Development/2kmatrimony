import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BlockedItem, ProfileCard, SendInterestResult } from '@2k/shared';
import { POST as sendInterest } from '@/app/api/v1/interests/route';
import { POST as respond } from '@/app/api/v1/interests/[id]/route';
import { GET as listBlocks, POST as block } from '@/app/api/v1/blocks/route';
import { DELETE as unblock } from '@/app/api/v1/blocks/[profileId]/route';
import { POST as report } from '@/app/api/v1/reports/route';
import { GET as profile } from '@/app/api/v1/profiles/[id]/route';
import { POST as search } from '@/app/api/v1/search/route';
import { admin, call, request } from './helpers';
import { deleteUsers, seedMember, uniqueCity, type SeededMember } from './discovery.fixtures';

let a: SeededMember, b: SeededMember, c: SeededMember, r1: SeededMember, r2: SeededMember, r3: SeededMember, target: SeededMember;
const city = uniqueCity();

beforeAll(async () => {
  [a, b, c, r1, r2, r3, target] = await Promise.all([
    seedMember({ label: 'saf-a', gender: 'female', seeking: 'male', city }),
    seedMember({ label: 'saf-b', gender: 'male', seeking: 'female', city }),
    seedMember({ label: 'saf-c', gender: 'male', seeking: 'female', city }),
    seedMember({ label: 'saf-r1', gender: 'female', seeking: 'male' }),
    seedMember({ label: 'saf-r2', gender: 'female', seeking: 'male' }),
    seedMember({ label: 'saf-r3', gender: 'female', seeking: 'male' }),
    seedMember({ label: 'saf-t', gender: 'male', seeking: 'female' }),
  ]);
});
afterAll(() => deleteUsers([a, b, c, r1, r2, r3, target]));

describe('blocking', () => {
  it('hides both members from each other, withdraws interests and closes connections', async () => {
    // b → a pending interest; a ↔ c connected
    await call(sendInterest, request('/api/v1/interests', { token: b.token, body: { receiverProfileId: a.profileId } }));
    const s = await call<SendInterestResult>(sendInterest, request('/api/v1/interests', { token: c.token, body: { receiverProfileId: a.profileId } }));
    const acc = await call<{ conversationId: string }>(respond, request(`/api/v1/interests/${s.body.data!.interestId}`, { token: a.token, body: { action: 'accept' } }), { id: s.body.data!.interestId });

    expect((await call(block, request('/api/v1/blocks', { token: a.token, body: { targetProfileId: b.profileId } }))).status).toBe(200);
    expect((await call(block, request('/api/v1/blocks', { token: a.token, body: { targetProfileId: c.profileId } }))).status).toBe(200);

    // b can no longer see a (and vice versa)
    expect((await call(profile, request(`/api/v1/profiles/${a.profileId}`, { token: b.token }), { id: a.profileId })).status).toBe(404);
    expect((await call(profile, request(`/api/v1/profiles/${b.profileId}`, { token: a.token }), { id: b.profileId })).status).toBe(404);
    const found = await call<{ items: ProfileCard[] }>(search, request('/api/v1/search', { token: b.token, body: { filters: { cities: [city] } } }));
    expect(found.body.data!.items.map((i) => i.id)).not.toContain(a.profileId);

    const { data: pending } = await admin().from('interests').select('status').eq('sender_profile_id', b.profileId).eq('receiver_profile_id', a.profileId).single();
    expect(pending?.status).toBe('withdrawn');
    const { data: conv } = await admin().from('conversations').select('is_locked').eq('id', acc.body.data!.conversationId).single();
    expect(conv?.is_locked).toBe(true);

    // interests can't be sent across a block
    expect((await call(sendInterest, request('/api/v1/interests', { token: b.token, body: { receiverProfileId: a.profileId } }))).status).toBe(404);

    const list = await call<BlockedItem[]>(listBlocks, request('/api/v1/blocks', { token: a.token }));
    expect(list.body.data!.map((x) => x.profileId)).toEqual(expect.arrayContaining([b.profileId, c.profileId]));
    await call(unblock, request(`/api/v1/blocks/${b.profileId}`, { token: a.token, method: 'DELETE' }), { profileId: b.profileId });
    expect((await call(profile, request(`/api/v1/profiles/${b.profileId}`, { token: a.token }), { id: b.profileId })).status).toBe(200);
  });
});

describe('reports', () => {
  it('prioritises urgent reasons and raises a review signal after three reporters', async () => {
    const u = await call<{ reportId: string }>(report, request('/api/v1/reports', { token: r1.token, body: { targetProfileId: target.profileId, reason: 'underage' } }));
    expect(u.status).toBe(200);
    const { data: row } = await admin().from('reports').select('priority, status').eq('id', u.body.data!.reportId).single();
    expect(row).toEqual({ priority: 'urgent', status: 'open' });
    await call(report, request('/api/v1/reports', { token: r2.token, body: { targetProfileId: target.profileId, reason: 'spam' } }));
    const { data: none } = await admin().from('risk_signals').select('id').eq('user_id', target.userId).eq('kind', 'reported_repeatedly');
    expect(none).toEqual([]);
    await call(report, request('/api/v1/reports', { token: r3.token, body: { targetProfileId: target.profileId, reason: 'fake_profile', details: 'Photos look copied.' } }));
    const { data: sig } = await admin().from('risk_signals').select('status').eq('user_id', target.userId).eq('kind', 'reported_repeatedly');
    expect(sig).toEqual([{ status: 'open' }]);
    // reports never change the target's account automatically
    const { data: acct } = await admin().from('app_users').select('status').eq('id', target.userId).single();
    expect(acct?.status).toBe('active');
  });

  it('validates targets', async () => {
    expect((await call(report, request('/api/v1/reports', { token: r1.token, body: { reason: 'spam' } }))).status).toBe(422);
    expect((await call(report, request('/api/v1/reports', { token: r1.token, body: { targetProfileId: r1.profileId, reason: 'spam' } }))).status).toBe(422);
  });
});
