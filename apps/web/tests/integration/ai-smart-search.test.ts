import { afterAll, describe, expect, it } from 'vitest';
import type { SmartSearchInterpretation } from '@2k/shared';
import { POST as smart } from '@/app/api/v1/search/smart/route';
import { call, request } from './helpers';
import { cleanupCreated, createMember, givePlan } from './ai-fixtures';

afterAll(cleanupCreated);

describe('POST /search/smart (rules fallback, no AI key)', () => {
  it('interprets natural language and strips advanced filters on Free with a notice', async () => {
    const m = await createMember({ label: 'ssa', gender: 'female', seeking: 'male' });
    const r = await call<SmartSearchInterpretation>(smart, request('/api/v1/search/smart', { token: m.user.token, body: { query: 'Career-oriented people aged 28-34 who value family and want to settle in Bangalore' } }));
    expect(r.status).toBe(200);
    const d = r.body.data!;
    expect(d.generator).toBe('rules');
    expect(d.filters).toMatchObject({ ageMin: 28, ageMax: 34 });
    expect(d.filters.cities).toEqual(expect.arrayContaining(['Bengaluru']));
    expect(d.filters.coreValues).toBeUndefined(); // advanced on Free
    expect(d.softPreferences).toEqual(expect.arrayContaining(['career-oriented', 'family']));
    expect(d.summary).toMatch(/Plus and above/);
  });

  it('keeps advanced filters on Plus', async () => {
    const m = await createMember({ label: 'ssb', gender: 'female', seeking: 'male' });
    await givePlan(m, 'plus');
    const r = await call<SmartSearchInterpretation>(smart, request('/api/v1/search/smart', { token: m.user.token, body: { query: 'open to relocating after marriage, values family' } }));
    expect(r.body.data?.filters.relocation).toEqual(['open', 'within_country']);
    expect(r.body.data?.filters.coreValues).toEqual(['family']);
  });

  it('enforces the daily quota (Free = 3)', async () => {
    const m = await createMember({ label: 'ssc', gender: 'female', seeking: 'male' });
    for (let i = 0; i < 3; i++) expect((await call(smart, request('/api/v1/search/smart', { token: m.user.token, body: { query: 'vegetarian in Pune' } }))).status).toBe(200);
    const r = await call(smart, request('/api/v1/search/smart', { token: m.user.token, body: { query: 'vegetarian in Pune' } }));
    expect(r.status).toBe(402);
    expect(r.body.error?.code).toBe('entitlement_required');
  });

  it('validates input', async () => {
    const m = await createMember({ label: 'ssd', gender: 'female', seeking: 'male' });
    expect((await call(smart, request('/api/v1/search/smart', { token: m.user.token, body: { query: 'a' } }))).status).toBe(422);
  });
});
