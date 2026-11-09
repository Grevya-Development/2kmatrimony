import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { admin, call, request } from './helpers';
import { deleteUsers, seedMember, type SeededMember } from './discovery.fixtures';

// PostHog configured for this file; the SDK is mocked to observe captures.
const captures: { distinctId: string; event: string; properties: Record<string, unknown> }[] = [];
vi.mock('posthog-node', () => ({
  PostHog: class {
    capture(e: { distinctId: string; event: string; properties: Record<string, unknown> }) { captures.push(e); }
    async flush() {}
  },
}));

const created: SeededMember[] = [];
let mod: {
  search: typeof import('@/app/api/v1/search/route').POST;
  consents: typeof import('@/app/api/v1/settings/consents/route').POST;
  me: typeof import('@/app/api/v1/me/route').GET;
};

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test_key');
  vi.resetModules();
  mod = {
    search: (await import('@/app/api/v1/search/route')).POST,
    consents: (await import('@/app/api/v1/settings/consents/route')).POST,
    me: (await import('@/app/api/v1/me/route')).GET,
  };
});
afterAll(async () => { vi.unstubAllEnvs(); await deleteUsers(created); });

const waitFor = async <T>(fn: () => Promise<T | null | undefined>, ms = 5000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 100));
  }
};
const doSearch = (token: string) => call(mod.search, request('/api/v1/search', { token, body: { filters: { cities: ['Bengaluru'], ageMin: 25 }, sort: 'compatibility', limit: 5 } }));

describe('product analytics (PostHog) — consent-gated, privacy-safe', () => {
  it('writes a sanitized first-party event but sends nothing to PostHog without consent', async () => {
    const u = await seedMember({ label: 'ph-a', gender: 'female', seeking: 'male' });
    created.push(u);
    const meBefore = await call<{ analyticsConsent: boolean | null }>(mod.me, request('/api/v1/me', { token: u.token }));
    expect(meBefore.body.data?.analyticsConsent).toBeNull();

    expect((await doSearch(u.token)).status).toBe(200);
    const row = await waitFor(async () => (await admin().from('analytics_events').select('event, properties').eq('user_id', u.userId).eq('event', 'search_performed').maybeSingle()).data);
    expect(row.properties).toMatchObject({ sort: 'compatibility' });
    expect(JSON.stringify(row.properties)).not.toMatch(/9876543210|Bengaluru/); // filter values never logged
    expect(captures.filter((c) => c.distinctId === u.userId)).toHaveLength(0);
  });

  it('captures to PostHog with the pseudonymous id only after opt-in, and stops after withdrawal', async () => {
    const u = await seedMember({ label: 'ph-b', gender: 'female', seeking: 'male' });
    created.push(u);
    expect((await call(mod.consents, request('/api/v1/settings/consents', { token: u.token, body: { consentType: 'product_analytics', granted: true } }))).status).toBe(200);
    const me = await call<{ analyticsConsent: boolean | null }>(mod.me, request('/api/v1/me', { token: u.token }));
    expect(me.body.data?.analyticsConsent).toBe(true);

    await doSearch(u.token);
    const cap = await waitFor(async () => captures.find((c) => c.distinctId === u.userId && c.event === 'search_performed'));
    expect(cap.properties).toMatchObject({ sort: 'compatibility', platform: 'web' });
    expect(JSON.stringify(cap)).not.toMatch(/@|9876543210|first_name|email/);

    await call(mod.consents, request('/api/v1/settings/consents', { token: u.token, body: { consentType: 'product_analytics', granted: false } }));
    const before = captures.filter((c) => c.distinctId === u.userId).length;
    await doSearch(u.token);
    await waitFor(async () => (await admin().from('analytics_events').select('id').eq('user_id', u.userId).eq('event', 'search_performed')).data?.length === 2 ? true : null);
    await new Promise((r) => setTimeout(r, 300));
    expect(captures.filter((c) => c.distinctId === u.userId).length).toBe(before);
  });

  it('respects the product_analytics kill switch', async () => {
    const u = await seedMember({ label: 'ph-c', gender: 'female', seeking: 'male' });
    created.push(u);
    await call(mod.consents, request('/api/v1/settings/consents', { token: u.token, body: { consentType: 'product_analytics', granted: true } }));
    await admin().from('feature_flags').update({ enabled: false }).eq('key', 'product_analytics');
    try {
      const { invalidateConfigCache } = await import('@/server/config');
      invalidateConfigCache();
      await doSearch(u.token);
      await waitFor(async () => (await admin().from('analytics_events').select('id').eq('user_id', u.userId).eq('event', 'search_performed').maybeSingle()).data);
      await new Promise((r) => setTimeout(r, 300));
      expect(captures.filter((c) => c.distinctId === u.userId)).toHaveLength(0);
    } finally {
      await admin().from('feature_flags').update({ enabled: true }).eq('key', 'product_analytics');
    }
  });
});
