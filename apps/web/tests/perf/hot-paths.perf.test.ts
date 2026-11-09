import { afterAll, describe, expect, it } from 'vitest';
import { POST as search } from '@/app/api/v1/search/route';
import { GET as recommendations } from '@/app/api/v1/recommendations/route';
import { GET as profile } from '@/app/api/v1/profiles/[id]/route';
import { admin, call, request } from '../integration/helpers';
import { deleteUsers, seedMember, type SeededMember } from '../integration/discovery.fixtures';

/**
 * Performance check for the hot read paths with a populated database.
 * Opt-in: seed with tests/perf/seed.sql (2,000 profiles) then run
 *   PERF=1 npx vitest run --config vitest.integration.config.ts tests/perf
 */
const run = process.env.PERF ? describe : describe.skip;
const created: SeededMember[] = [];
afterAll(async () => deleteUsers(created));

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1]!;
async function time(n: number, fn: () => Promise<{ status: number }>) {
  const ms: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    const r = await fn();
    expect(r.status).toBe(200);
    ms.push(performance.now() - t);
  }
  return { p50: [...ms].sort((a, b) => a - b)[Math.floor(n / 2)]!, p95: p95(ms) };
}

run('hot paths with ~2,000 profiles', () => {
  it('search, recommendations and profile view stay fast', async () => {
    const { count } = await admin().from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active');
    expect(count ?? 0).toBeGreaterThan(1500);
    const viewer = await seedMember({ label: 'perf', gender: 'female', seeking: 'male', city: 'Bengaluru' });
    created.push(viewer);

    const s = await time(8, () => call(search, request('/api/v1/search', { token: viewer.token, body: { filters: { ageMin: 25, ageMax: 36 }, sort: 'relevance', limit: 20 } })));
    const st = await time(8, () => call(search, request('/api/v1/search', { token: viewer.token, body: { filters: { cities: ['Bengaluru'] }, sort: 'compatibility', limit: 20 } })));
    const r = await time(5, () => call(recommendations, request('/api/v1/recommendations', { token: viewer.token })));
    const { data: any } = await admin().from('profiles').select('id').eq('status', 'active').eq('gender', 'male').limit(1).single();
    const p = await time(8, () => call(profile, request(`/api/v1/profiles/${any!.id}`, { token: viewer.token }), { id: any!.id }));

    console.table({ search: s, searchCityByCompat: st, recommendations: r, profileView: p });
    expect(s.p95).toBeLessThan(2000);
    expect(st.p95).toBeLessThan(2000);
    expect(r.p95).toBeLessThan(4000);
    expect(p.p95).toBeLessThan(1000);
  });
});
