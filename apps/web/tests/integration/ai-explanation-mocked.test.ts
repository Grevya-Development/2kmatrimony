import { afterAll, describe, expect, it, vi } from 'vitest';
import type { MatchExplanation } from '@2k/shared';

// Simulate a configured model; everything else (DB, engine, projection) is real.
const runStructured = vi.fn(async () => ({
  output: {
    headline: 'You share a love of books and music.',
    alignments: ['You both enjoy reading', 'Family matters to you both'],
    differences: ['Where to settle may be worth talking about'],
    conversationStarters: ['What book changed how you think?', 'Which song takes you back?', 'What does a calm Sunday look like?', 'Where would you love to hike?', 'What are you learning lately?'],
  },
  model: 'claude-opus-5-5',
  promptVersion: null,
}));
vi.mock('@/server/ai/client', async (orig) => ({ ...(await orig<typeof import('@/server/ai/client')>()), aiAvailable: vi.fn(async () => true), runStructured }));

const { GET: explanation } = await import('@/app/api/v1/profiles/[id]/explanation/route');
const { call, request, admin } = await import('./helpers');
const { cleanupCreated, createMember, givePlan } = await import('./ai-fixtures');

afterAll(cleanupCreated);

describe('explanation with AI enrichment (mocked model)', () => {
  it('never calls the model without the member’s AI-processing consent', async () => {
    const a = await createMember({ label: 'ma', gender: 'female', seeking: 'male', aiConsent: false });
    const b = await createMember({ label: 'mb', gender: 'male', seeking: 'female' });
    runStructured.mockClear();
    const r = await call<MatchExplanation>(explanation, request(`/api/v1/profiles/${b.profileId}/explanation`, { token: a.user.token }), { id: b.profileId });
    expect(r.body.data?.generator).toBe('engine');
    expect(runStructured).not.toHaveBeenCalled();
  });

  it('free member + consent: full AI rewrite (everything is free), cached by fingerprint', async () => {
    const a = await createMember({ label: 'mc', gender: 'female', seeking: 'male', aiConsent: true });
    const b = await createMember({ label: 'md', gender: 'male', seeking: 'female' });
    runStructured.mockClear();
    const r1 = await call<MatchExplanation>(explanation, request(`/api/v1/profiles/${b.profileId}/explanation`, { token: a.user.token }), { id: b.profileId });
    expect(r1.status).toBe(200);
    expect(r1.body.data?.generator).toBe('ai');
    expect(r1.body.data?.headline).toBe('You share a love of books and music.');
    expect(r1.body.data?.conversationStarters).toHaveLength(5);
    expect(runStructured).toHaveBeenCalledTimes(1);
    const call0 = runStructured.mock.calls[0] as unknown as [{ feature: string; input: string }];
    expect(call0[0].feature).toBe('match_explanation');
    expect(call0[0].input).toContain('<engine_facts>');

    const r2 = await call<MatchExplanation>(explanation, request(`/api/v1/profiles/${b.profileId}/explanation`, { token: a.user.token }), { id: b.profileId });
    expect(r2.body.data?.generator).toBe('ai');
    expect(runStructured).toHaveBeenCalledTimes(1); // served from cache
    const { data } = await admin().from('match_explanations').select('generator').eq('viewer_profile_id', a.profileId).eq('candidate_profile_id', b.profileId).single();
    expect(data?.generator).toBe('ai');
  });

  it('without AI consent, premium members get the engine explanation', async () => {
    const a = await createMember({ label: 'me', gender: 'female', seeking: 'male', aiConsent: false });
    const b = await createMember({ label: 'mf', gender: 'male', seeking: 'female' });
    await givePlan(a, 'premium');
    runStructured.mockClear();
    const r = await call<MatchExplanation>(explanation, request(`/api/v1/profiles/${b.profileId}/explanation`, { token: a.user.token }), { id: b.profileId });
    expect(r.body.data?.generator).toBe('engine');
    expect(runStructured).not.toHaveBeenCalled();
  });

  it('model failure falls back to the engine explanation', async () => {
    const a = await createMember({ label: 'mg', gender: 'female', seeking: 'male', aiConsent: true });
    const b = await createMember({ label: 'mh', gender: 'male', seeking: 'female' });
    await givePlan(a, 'plus');
    runStructured.mockRejectedValueOnce(new Error('boom'));
    const r = await call<MatchExplanation>(explanation, request(`/api/v1/profiles/${b.profileId}/explanation`, { token: a.user.token }), { id: b.profileId });
    expect(r.status).toBe(200);
    expect(r.body.data?.generator).toBe('engine');
  });
});
