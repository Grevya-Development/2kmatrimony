import { setUsage } from './quota-helpers';
import { afterAll, describe, expect, it } from 'vitest';
import type { SmartSearchInterpretation } from '@2k/shared';
import { POST as smart } from '@/app/api/v1/search/smart/route';
import { call, request } from './helpers';
import { cleanupCreated, createMember, givePlan } from './ai-fixtures';

afterAll(cleanupCreated);

describe('POST /search/smart (rules fallback, no AI key)', () => {
  it('interprets natural language and keeps advanced filters (everything is free)', async () => {
    const m = await createMember({ label: 'ssa', gender: 'female', seeking: 'male' });
    const r = await call<SmartSearchInterpretation>(smart, request('/api/v1/search/smart', { token: m.user.token, body: { query: 'Career-oriented people aged 28-34 who value family and want to settle in Bangalore' } }));
    expect(r.status).toBe(200);
    const d = r.body.data!;
    expect(d.generator).toBe('rules');
    expect(d.filters).toMatchObject({ ageMin: 28, ageMax: 34 });
    expect(d.filters.cities).toEqual(expect.arrayContaining(['Bengaluru']));
    expect(d.filters.coreValues).toEqual(['family']); // advanced filters are free for everyone
    expect(d.softPreferences).toEqual(expect.arrayContaining(['career-oriented']));
    expect(d.summary).not.toMatch(/Plus|plan|upgrade/i);
  });

  it('keeps advanced filters on Plus', async () => {
    const m = await createMember({ label: 'ssb', gender: 'female', seeking: 'male' });
    await givePlan(m, 'plus');
    const r = await call<SmartSearchInterpretation>(smart, request('/api/v1/search/smart', { token: m.user.token, body: { query: 'open to relocating after marriage, values family' } }));
    expect(r.body.data?.filters.relocation).toEqual(['open', 'within_country']);
    expect(r.body.data?.filters.coreValues).toEqual(['family']);
  });

  it('still enforces the anti-abuse daily cap (300 for everyone)', async () => {
    const m = await createMember({ label: 'ssc', gender: 'female', seeking: 'male' });
    await setUsage(m.user.userId, 'smart_search', 299);
    expect((await call(smart, request('/api/v1/search/smart', { token: m.user.token, body: { query: 'vegetarian in Pune' } }))).status).toBe(200);
    const r = await call(smart, request('/api/v1/search/smart', { token: m.user.token, body: { query: 'vegetarian in Pune' } }));
    expect(r.status).toBe(402);
    expect(r.body.error?.code).toBe('entitlement_required');
  });

  it('validates input', async () => {
    const m = await createMember({ label: 'ssd', gender: 'female', seeking: 'male' });
    expect((await call(smart, request('/api/v1/search/smart', { token: m.user.token, body: { query: 'a' } }))).status).toBe(422);
  });
});
