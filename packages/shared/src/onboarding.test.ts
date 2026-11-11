import { describe, expect, it } from 'vitest';
import { defaultPartnerBasics, quickStepFor } from './onboarding';
import { ageFromDob } from './format';

describe('quick onboarding helpers', () => {
  it('maps saved steps onto the quick flow', () => {
    expect(quickStepFor(null, false)).toBe('start');
    expect(quickStepFor(null, true)).toBe('basics');
    expect(quickStepFor('start', true)).toBe('basics');
    expect(quickStepFor('photos', true)).toBe('photos');
    expect(quickStepFor('values', true)).toBe('preferences');
    expect(quickStepFor('education', true)).toBe('preferences');
    expect(quickStepFor('done', true)).toBe('done');
  });
  it('computes age from a date of birth', () => {
    expect(ageFromDob('1995-06-15', new Date('2026-06-14T00:00:00Z'))).toBe(30);
    expect(ageFromDob('1995-06-15', new Date('2026-06-15T00:00:00Z'))).toBe(31);
    expect(ageFromDob(null)).toBeNull();
  });
  it('suggests partner basics from gender and age', () => {
    const now = new Date().getUTCFullYear();
    const r = defaultPartnerBasics('male', `${now - 30}-01-01`);
    expect(r.seekingGenders).toEqual(['female']);
    expect(r.ageMin).toBe(25);
    expect(r.ageMax).toBe(35);
    expect(defaultPartnerBasics('female', null)).toEqual({ seekingGenders: ['male'], ageMin: 24, ageMax: 34 });
    expect(defaultPartnerBasics('other', `${now - 19}-01-01`).ageMin).toBe(18);
  });
});
