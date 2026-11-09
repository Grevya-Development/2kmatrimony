import { afterAll, describe, expect, it } from 'vitest';
import type { ReadinessNote } from '@2k/shared';
import { GET as getReadiness, PUT as putNote } from '@/app/api/v1/readiness/route';
import { GET as history, POST as chat } from '@/app/api/v1/readiness/chat/route';
import { call, request } from './helpers';
import { cleanupCreated, createMember } from './ai-fixtures';

afterAll(cleanupCreated);

describe('marriage readiness assistant', () => {
  it('notes work without AI; chat explains it is unconfigured', async () => {
    const m = await createMember({ label: 'rda', gender: 'female', seeking: 'male', aiConsent: true });
    const s = await call<{ notes: ReadinessNote[]; aiAvailable: boolean }>(getReadiness, request('/api/v1/readiness', { token: m.user.token }));
    expect(s.body.data?.notes).toHaveLength(11);
    expect(s.body.data?.aiAvailable).toBe(false);
    const p = await call<ReadinessNote>(putNote, request('/api/v1/readiness', { method: 'PUT', token: m.user.token, body: { topic: 'finances', myView: 'Shared goals, separate fun money.', questionsToAsk: ['How do you approach saving?'] } }));
    expect(p.status).toBe(200);
    const s2 = await call<{ notes: ReadinessNote[] }>(getReadiness, request('/api/v1/readiness', { token: m.user.token }));
    expect(s2.body.data?.notes.find((n) => n.topic === 'finances')).toMatchObject({ myView: 'Shared goals, separate fun money.', questionsToAsk: ['How do you approach saving?'] });
    const c = await call(chat, request('/api/v1/readiness/chat', { token: m.user.token, body: { topic: 'finances', message: 'How should I raise this?' } }));
    expect(c.status).toBe(503);
    expect(c.body.error?.code).toBe('service_unconfigured');
    expect((await call<unknown[]>(history, request('/api/v1/readiness/chat?topic=finances', { token: m.user.token }))).body.data).toEqual([]);
    expect((await call(putNote, request('/api/v1/readiness', { method: 'PUT', token: m.user.token, body: { topic: 'nope', questionsToAsk: [] } }))).status).toBe(422);
  });
});
