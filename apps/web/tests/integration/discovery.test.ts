import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProfileCard, ProfileDetail, ProfileViewersResponse, RecommendationItem, ShortlistItem } from '@2k/shared';
import { GET as recommendations } from '@/app/api/v1/recommendations/route';
import { POST as recAction } from '@/app/api/v1/recommendations/[id]/route';
import { GET as profile } from '@/app/api/v1/profiles/[id]/route';
import { GET as viewers } from '@/app/api/v1/profiles/viewers/route';
import { POST as search } from '@/app/api/v1/search/route';
import { GET as listShortlist, POST as addShortlist } from '@/app/api/v1/shortlist/route';
import { DELETE as removeShortlist } from '@/app/api/v1/shortlist/[profileId]/route';
import { POST as pass } from '@/app/api/v1/passes/route';
import { DELETE as unpass } from '@/app/api/v1/passes/[profileId]/route';
import { POST as feedback } from '@/app/api/v1/match-feedback/route';
import { admin, call, request } from './helpers';
import { deleteUsers, seedMember, uniqueCity, type SeededMember } from './discovery.fixtures';

let a: SeededMember, b: SeededMember, c: SeededMember;
const city = uniqueCity();

beforeAll(async () => {
  [a, b, c] = await Promise.all([
    seedMember({ label: 'disc-a', gender: 'female', seeking: 'male', city, dnaBase: 95 }),
    seedMember({ label: 'disc-b', gender: 'male', seeking: 'female', city, interests: ['Travel', 'Reading', 'Hiking'], dnaBase: 95 }),
    seedMember({ label: 'disc-c', gender: 'male', seeking: 'female', city: 'Chennai' }),
  ]);
});
afterAll(() => deleteUsers([a, b, c]));

describe('recommendations', () => {
  it('generates today\'s mutual recommendations on demand', async () => {
    const r = await call<RecommendationItem[]>(recommendations, request('/api/v1/recommendations', { token: a.token }));
    expect(r.status).toBe(200);
    const mine = r.body.data!.find((i) => i.profile.id === b.profileId);
    expect(mine).toBeDefined();
    expect(mine!.profile.compatibility?.mutual).toBeGreaterThanOrEqual(55);
    expect(mine!.reason).toBeTruthy();
    // second call returns the same batch (no regeneration)
    const r2 = await call<RecommendationItem[]>(recommendations, request('/api/v1/recommendations', { token: a.token }));
    expect(r2.body.data!.map((i) => i.id).sort()).toEqual(r.body.data!.map((i) => i.id).sort());
  });

  it('pass hides a recommendation and undo restores it', async () => {
    const list = (await call<RecommendationItem[]>(recommendations, request('/api/v1/recommendations', { token: a.token }))).body.data!;
    const rec = list.find((i) => i.profile.id === b.profileId)!;
    const p = await call(recAction, request(`/api/v1/recommendations/${rec.id}`, { token: a.token, body: { action: 'passed' } }), { id: rec.id });
    expect(p.status).toBe(200);
    const after = (await call<RecommendationItem[]>(recommendations, request('/api/v1/recommendations', { token: a.token }))).body.data!;
    expect(after.some((i) => i.profile.id === b.profileId)).toBe(false);
    await call(unpass, request(`/api/v1/passes/${b.profileId}`, { token: a.token, method: 'DELETE' }), { profileId: b.profileId });
    const restored = (await call<RecommendationItem[]>(recommendations, request('/api/v1/recommendations', { token: a.token }))).body.data!;
    expect(restored.some((i) => i.profile.id === b.profileId)).toBe(true);
  });
});

describe('profile view', () => {
  it('returns a privacy-projected profile and records one view per day', async () => {
    const r = await call<ProfileDetail>(profile, request(`/api/v1/profiles/${b.profileId}`, { token: a.token }), { id: b.profileId });
    expect(r.status).toBe(200);
    expect(r.body.data!.id).toBe(b.profileId);
    expect(r.body.data!.compatibility).not.toBeNull();
    expect(r.body.data!.isOwnProfile).toBe(false);
    expect(JSON.stringify(r.body.data)).not.toContain('owner_user_id');
    expect(r.body.data!.displayName).toMatch(/Test|T\./); // last name masked to initial by default
    await call(profile, request(`/api/v1/profiles/${b.profileId}`, { token: a.token }), { id: b.profileId });
    const { count } = await admin().from('profile_views').select('id', { count: 'exact', head: true }).eq('viewer_profile_id', a.profileId).eq('viewed_profile_id', b.profileId);
    expect(count).toBe(1);
  });

  it('who-viewed-me is locked to a count on the free plan', async () => {
    const r = await call<ProfileViewersResponse>(viewers, request('/api/v1/profiles/viewers', { token: b.token }));
    expect(r.body.data!.locked).toBe(true);
    expect(r.body.data!.count).toBeGreaterThanOrEqual(1);
    expect(r.body.data!.items).toEqual([]);
  });

  it('404s for unknown ids', async () => {
    const id = '00000000-0000-0000-0000-000000000000';
    const r = await call(profile, request(`/api/v1/profiles/${id}`, { token: a.token }), { id });
    expect(r.status).toBe(404);
  });
});

describe('search', () => {
  it('filters by city and ranks with compatibility', async () => {
    const r = await call<{ items: ProfileCard[]; total: number }>(search, request('/api/v1/search', { token: a.token, body: { filters: { cities: [city] }, sort: 'compatibility' } }));
    expect(r.status).toBe(200);
    const ids = r.body.data!.items.map((i) => i.id);
    expect(ids).toContain(b.profileId);
    expect(ids).not.toContain(c.profileId); // different city
    expect(ids).not.toContain(a.profileId); // never yourself
  });

  it('gates advanced filters behind the plan', async () => {
    const r = await call(search, request('/api/v1/search', { token: a.token, body: { filters: { professions: ['Engineer'] } } }));
    expect(r.status).toBe(402);
    expect(r.body.error?.code).toBe('entitlement_required');
  });

  it('validates input', async () => {
    const r = await call(search, request('/api/v1/search', { token: a.token, body: { filters: { ageMin: 10 } } }));
    expect(r.status).toBe(422);
  });
});

describe('shortlist & feedback', () => {
  it('adds, lists and removes', async () => {
    expect((await call(addShortlist, request('/api/v1/shortlist', { token: a.token, body: { targetProfileId: c.profileId, note: 'Kind words' } }))).status).toBe(200);
    const list = await call<ShortlistItem[]>(listShortlist, request('/api/v1/shortlist', { token: a.token }));
    expect(list.body.data!.find((i) => i.profile.id === c.profileId)?.note).toBe('Kind words');
    await call(removeShortlist, request(`/api/v1/shortlist/${c.profileId}`, { token: a.token, method: 'DELETE' }), { profileId: c.profileId });
    const after = await call<ShortlistItem[]>(listShortlist, request('/api/v1/shortlist', { token: a.token }));
    expect(after.body.data!.some((i) => i.profile.id === c.profileId)).toBe(false);
  });

  it('passes via /passes and records match feedback', async () => {
    expect((await call(pass, request('/api/v1/passes', { token: a.token, body: { targetProfileId: c.profileId } }))).status).toBe(200);
    const f = await call(feedback, request('/api/v1/match-feedback', { token: a.token, body: { candidateProfileId: b.profileId, rating: 1, reason: 'great_fit' } }));
    expect(f.status).toBe(200);
    const { data } = await admin().from('match_feedback').select('rating, mutual_score_at_time').eq('profile_id', a.profileId).eq('candidate_profile_id', b.profileId).single();
    expect(data?.rating).toBe(1);
    expect(data?.mutual_score_at_time).not.toBeNull();
  });
});
