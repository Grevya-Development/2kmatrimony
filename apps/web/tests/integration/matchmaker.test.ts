import { afterAll, describe, expect, it } from 'vitest';
import type { MatchmakerMessage, MatchmakerStatus, MatchmakerThreadSummary, SearchFilters } from '@2k/shared';
import { POST as turn } from '@/app/api/v1/matchmaker/route';
import { GET as threads } from '@/app/api/v1/matchmaker/threads/route';
import { DELETE as delThread, GET as thread } from '@/app/api/v1/matchmaker/threads/[id]/route';
import { POST as apply } from '@/app/api/v1/matchmaker/threads/[id]/apply/route';
import { call, request } from './helpers';
import { cleanupCreated, createMember } from './ai-fixtures';

afterAll(cleanupCreated);

type ThreadPayload = { id: string; title: string | null; filters: SearchFilters | null; softPreferences: string[]; messages: MatchmakerMessage[] };

describe('AI matchmaker (rules mode, no AI key)', () => {
  it('runs a full turn: streams a reply, stores structured filters and returns matching profiles', async () => {
    const city = `Ooty${Date.now() % 100000}`; // unique city so results are deterministic
    const seeker = await createMember({ label: 'mma', gender: 'female', seeking: 'male', city: 'Coimbatore' });
    const match = await createMember({ label: 'mmb', gender: 'male', seeking: 'female', city, age: 31 });
    await createMember({ label: 'mmc', gender: 'male', seeking: 'female', city, age: 44 }); // outside age range

    const st = await call<{ threads: MatchmakerThreadSummary[]; status: MatchmakerStatus }>(threads, request('/api/v1/matchmaker/threads', { token: seeker.user.token }));
    expect(st.body.data?.status).toMatchObject({ aiAvailable: false, remainingToday: 3, dailyLimit: 3 });

    // Rules parser does not know this synthetic city name, so use filters via apply after the first turn.
    const res = await turn(request('/api/v1/matchmaker', { token: seeker.user.token, body: { message: 'Someone vegetarian aged 28-35 who loves reading' } }), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const threadId = res.headers.get('x-thread-id')!;
    const text = await res.text();
    expect(text).toMatch(/Looking for people/);

    const t = await call<ThreadPayload>(thread, request(`/api/v1/matchmaker/threads/${threadId}`, { token: seeker.user.token }), { id: threadId });
    expect(t.status).toBe(200);
    expect(t.body.data?.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    const s = t.body.data!.messages[1]!.structured!;
    expect(s.intent).toBe('search');
    expect(s.generator).toBe('rules');
    expect(s.filters).toMatchObject({ ageMin: 28, ageMax: 35, interests: ['Reading'] });

    const applied = await call<MatchmakerMessage>(apply, request(`/api/v1/matchmaker/threads/${threadId}/apply`, { token: seeker.user.token, body: { filters: { ...s.filters, cities: [city] }, softPreferences: [] } }), { id: threadId });
    expect(applied.status).toBe(200);
    expect(applied.body.data?.results.map((c) => c.id)).toEqual([match.profileId]);
    expect(applied.body.data?.results[0]?.compatibility?.mutual).toBeGreaterThan(0);

    const t2 = await call<ThreadPayload>(thread, request(`/api/v1/matchmaker/threads/${threadId}`, { token: seeker.user.token }), { id: threadId });
    expect(t2.body.data?.filters?.cities).toEqual([city]);
    expect(t2.body.data?.messages.at(-1)?.results.map((c) => c.id)).toEqual([match.profileId]);
  });

  it('refines within the same thread and enforces the daily quota', async () => {
    const seeker = await createMember({ label: 'mmd', gender: 'male', seeking: 'female' });
    const r1 = await turn(request('/api/v1/matchmaker', { token: seeker.user.token, body: { message: 'aged 25-30 in Chennai' } }), { params: Promise.resolve({}) });
    const threadId = r1.headers.get('x-thread-id')!;
    await r1.text();
    const r2 = await turn(request('/api/v1/matchmaker', { token: seeker.user.token, body: { threadId, message: 'vegetarian too' } }), { params: Promise.resolve({}) });
    expect(r2.headers.get('x-thread-id')).toBe(threadId);
    await r2.text();
    const t = await call<ThreadPayload>(thread, request(`/api/v1/matchmaker/threads/${threadId}`, { token: seeker.user.token }), { id: threadId });
    const last = t.body.data!.messages.at(-1)!.structured!;
    expect(last.intent).toBe('refine');
    expect(last.filters).toMatchObject({ ageMin: 25, ageMax: 30, diets: ['vegetarian', 'vegan', 'jain'] });
    expect(last.filters.cities).toEqual(expect.arrayContaining(['Chennai']));

    const r3 = await turn(request('/api/v1/matchmaker', { token: seeker.user.token, body: { threadId, message: 'hello' } }), { params: Promise.resolve({}) });
    await r3.text();
    const r4 = await call(turn as never, request('/api/v1/matchmaker', { token: seeker.user.token, body: { threadId, message: 'one more' } }));
    expect(r4.status).toBe(402);
  });

  it('threads are private to their owner and can be deleted', async () => {
    const owner = await createMember({ label: 'mme', gender: 'female', seeking: 'male' });
    const other = await createMember({ label: 'mmf', gender: 'female', seeking: 'male' });
    const r = await turn(request('/api/v1/matchmaker', { token: owner.user.token, body: { message: 'hi' } }), { params: Promise.resolve({}) });
    const threadId = r.headers.get('x-thread-id')!;
    await r.text();
    expect((await call(thread, request(`/api/v1/matchmaker/threads/${threadId}`, { token: other.user.token }), { id: threadId })).status).toBe(404);
    expect((await call(delThread, request(`/api/v1/matchmaker/threads/${threadId}`, { method: 'DELETE', token: other.user.token }), { id: threadId })).status).toBe(404);
    expect((await call(delThread, request(`/api/v1/matchmaker/threads/${threadId}`, { method: 'DELETE', token: owner.user.token }), { id: threadId })).status).toBe(200);
  });
});
