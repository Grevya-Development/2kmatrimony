import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/marketing/quick-start', () => ({ QUICKSTART_KEY: 'tk_quickstart' }));
const { readQuickStartPreferences, clearQuickStart } = await import('./quick-start-prefill');

function stubStorage(value: string | null) {
  const store = new Map<string, string>(value === null ? [] : [['tk_quickstart', value]]);
  vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store.get(k) ?? null, removeItem: (k: string) => store.delete(k) } });
  return store;
}
afterEach(() => vi.unstubAllGlobals());

describe('quick-start prefill', () => {
  it('maps the landing card to partner preferences', () => {
    stubStorage(JSON.stringify({ lookingFor: 'groom', ageMin: 27, ageMax: 33, motherTongue: 'Tamil', savedAt: '2026-11-10T00:00:00Z' }));
    expect(readQuickStartPreferences()).toEqual({ seekingGenders: ['male'], ageMin: 27, ageMax: 33, motherTongues: ['Tamil'] });
  });
  it('ignores invalid ranges and empty values', () => {
    stubStorage(JSON.stringify({ lookingFor: 'bride', ageMin: 40, ageMax: 30, motherTongue: '' }));
    expect(readQuickStartPreferences()).toEqual({ seekingGenders: ['female'] });
  });
  it('returns null when absent or malformed, and clears', () => {
    stubStorage(null);
    expect(readQuickStartPreferences()).toBeNull();
    const store = stubStorage('{not json');
    expect(readQuickStartPreferences()).toBeNull();
    clearQuickStart();
    expect(store.size).toBe(0);
  });
});
