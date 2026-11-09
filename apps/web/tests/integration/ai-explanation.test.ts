import { afterAll, describe, expect, it } from 'vitest';
import type { MatchExplanation } from '@2k/shared';
import { GET as explanation } from '@/app/api/v1/profiles/[id]/explanation/route';
import { POST as feedback } from '@/app/api/v1/ai/feedback/route';
import { buildExplanationInput } from '@/server/ai/features/explanation';
import { buildViewerContext } from '@/server/profiles/projection';
import { explainPair } from '@/server/matching/service';
import { admin, call, createTestUser, request } from './helpers';
import { cleanupCreated, connect, createMember, trackUser } from './ai-fixtures';

afterAll(cleanupCreated);

describe('GET /profiles/[id]/explanation (engine path, no AI key)', () => {
  it('returns a viewer-relative engine explanation', async () => {
    const a = await createMember({ label: 'exa', gender: 'female', seeking: 'male' });
    const b = await createMember({ label: 'exb', gender: 'male', seeking: 'female' });
    const r = await call<MatchExplanation>(explanation, request(`/api/v1/profiles/${b.profileId}/explanation`, { token: a.user.token }), { id: b.profileId });
    expect(r.status).toBe(200);
    expect(r.body.data?.candidateProfileId).toBe(b.profileId);
    expect(r.body.data?.generator).toBe('engine');
    expect(r.body.data?.dimensions).toHaveLength(9);
    expect(r.body.data?.compatibility.mutual).toBeGreaterThan(50);
    expect(r.body.data?.sharedInterests).toEqual(expect.arrayContaining(['Reading', 'Music']));
    expect(r.body.data?.disclaimer).toMatch(/not a prediction/i);
  });

  it('404s for blocked, unknown and own profiles; 409 without a profile', async () => {
    const a = await createMember({ label: 'exc', gender: 'female', seeking: 'male' });
    const b = await createMember({ label: 'exd', gender: 'male', seeking: 'female' });
    await admin().from('blocks').insert({ blocker_profile_id: b.profileId, blocked_profile_id: a.profileId });
    expect((await call(explanation, request(`/api/v1/profiles/${b.profileId}/explanation`, { token: a.user.token }), { id: b.profileId })).status).toBe(404);
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await call(explanation, request(`/api/v1/profiles/${missing}/explanation`, { token: a.user.token }), { id: missing })).status).toBe(404);
    expect((await call(explanation, request(`/api/v1/profiles/${a.profileId}/explanation`, { token: a.user.token }), { id: a.profileId })).status).toBe(404);
    const noProfile = await trackUser(await createTestUser('exnp'));
    expect((await call(explanation, request(`/api/v1/profiles/${b.profileId}/explanation`, { token: noProfile.token }), { id: b.profileId })).status).toBe(409);
  });

  it('records AI feedback', async () => {
    const a = await createMember({ label: 'exf', gender: 'female', seeking: 'male' });
    const r = await call(feedback, request('/api/v1/ai/feedback', { token: a.user.token, body: { feature: 'match_explanation', referenceId: 'x', rating: 1 } }));
    expect(r.status).toBe(200);
    const { data } = await admin().from('ai_feedback').select('rating').eq('user_id', a.user.userId);
    expect(data).toEqual([{ rating: 1 }]);
  });
});

describe('explanation grounding privacy', () => {
  it('never sends hidden sensitive fields of the candidate to the model; connected members see connection-level data', async () => {
    const viewer = await createMember({ label: 'pva', gender: 'female', seeking: 'male' });
    const cand = await createMember({ label: 'pvb', gender: 'male', seeking: 'female', religion: 'ZZSECRETFAITH', sensitive: 'connections' });
    const res = await explainPair(viewer.profileId, cand.profileId);
    const ctx = await buildViewerContext(viewer.profileId, [cand.profileId]);
    const input = (await buildExplanationInput(res!.explanation, viewer.profileId, cand.profileId, ctx))!;
    expect(input).toContain('<candidate>');
    expect(input).not.toContain('ZZSECRETFAITH');
    expect(input).not.toContain('15_25l'); // income hidden from non-connections
    expect(input).not.toContain(cand.user.email);
    // Communication style etc. are only shared once connected.
    expect(input.split('<candidate>')[1]).toContain('"communicationStyle": null');

    await connect(viewer, cand);
    const ctx2 = await buildViewerContext(viewer.profileId, [cand.profileId]);
    const input2 = (await buildExplanationInput(res!.explanation, viewer.profileId, cand.profileId, ctx2))!;
    expect(input2.split('<candidate>')[1]).toContain('"communicationStyle": "balanced"');
  });
});
