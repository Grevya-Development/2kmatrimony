import { describe, expect, it } from 'vitest';
import { ageFromDob, displayName, formatInr, compatibilityLabel } from './format';
import { resolveEntitlements, DEFAULT_ENTITLEMENTS } from './entitlements';
import { basicsSchema, partnerPreferencesSchema, isAdultDob, sendMessageSchema, checkoutSchema } from './schemas';

describe('format', () => {
  it('computes age correctly around birthdays', () => {
    const now = new Date('2026-11-09T00:00:00Z');
    expect(ageFromDob('1996-11-09', now)).toBe(30);
    expect(ageFromDob('1996-11-10', now)).toBe(29);
    expect(ageFromDob(null)).toBeNull();
  });
  it('respects name visibility', () => {
    expect(displayName('Ananya', 'Rao', 'full')).toBe('Ananya Rao');
    expect(displayName('Ananya', 'Rao', 'first_name')).toBe('Ananya R.');
    expect(displayName('Ananya', 'Rao', 'initials')).toBe('A. R.');
    expect(displayName(null, null, 'full')).toBe('Member');
  });
  it('formats rupees from paise', () => {
    expect(formatInr(99900)).toContain('999');
  });
  it('labels never promise outcomes', () => {
    expect(compatibilityLabel(90)).toBe('Exceptional alignment');
    expect(compatibilityLabel(10)).toBe('Different priorities');
  });
});

describe('entitlements', () => {
  it('falls back to defaults and ignores invalid types', () => {
    const e = resolveEntitlements([
      { key: 'interests_per_day', value: 10 },
      { key: 'advanced_filters', value: 'yes' },
      { key: 'unknown', value: 1 },
    ]);
    expect(e.interests_per_day).toBe(10);
    expect(e.advanced_filters).toBe(DEFAULT_ENTITLEMENTS.advanced_filters);
  });
});

describe('schemas', () => {
  it('rejects members under 18', () => {
    expect(isAdultDob('2015-01-01')).toBe(false);
    const r = basicsSchema.safeParse({ firstName: 'A', dateOfBirth: '2015-01-01', gender: 'female', maritalStatus: 'never_married', languages: [], currentCity: 'Pune' });
    expect(r.success).toBe(false);
  });
  it('validates age range ordering in preferences', () => {
    const r = partnerPreferencesSchema.safeParse({ seekingGenders: ['male'], ageMin: 35, ageMax: 30 });
    expect(r.success).toBe(false);
  });
  it('requires text body for text messages', () => {
    expect(sendMessageSchema.safeParse({ clientId: 'abcdefgh', kind: 'text', body: '' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ clientId: 'abcdefgh', kind: 'text', body: 'Hello' }).success).toBe(true);
  });
  it('does not allow checking out the free plan', () => {
    expect(checkoutSchema.safeParse({ planCode: 'free', interval: 'month' }).success).toBe(false);
  });
});
