import { describe, expect, it } from 'vitest';
import { buildMatchProfile as mp, evaluateDirection, evaluatePair, normaliseConfig, buildExplanation, DEFAULT_CONFIG, overlapScore, dnaFit } from './index';
import type { MatchPreferences, MatchProfile } from './types';

const prefs = (p: Partial<MatchPreferences>): MatchPreferences => ({
  seekingGenders: [], ageMin: null, ageMax: null, heightMinCm: null, heightMaxCm: null, maritalStatuses: [],
  educationLevels: [], minIncomeRange: null, countries: [], cities: [], openToRelocatePartner: null, diets: [],
  smokingOk: [], drinkingOk: [], familyValues: [], childrenPreferences: [], livingArrangements: [],
  personalityTraits: [], coreValues: [], motherTongues: [], religions: [], nonNegotiables: [], ...p,
});

const dna = (self: number, target: number | null = null, importance = 3, flexible = true) => ({ self, target, importance, flexible });

const base = (id: string, gender: 'female' | 'male', seeking: 'female' | 'male', extra: Partial<MatchProfile> = {}): MatchProfile =>
  mp({
    id, gender, age: 29, heightCm: 170, maritalStatus: 'never_married', city: 'Bengaluru', country: 'IN',
    educationLevel: 'masters', incomeRange: '15_25l', relocation: 'within_country', familyValues: 'moderate',
    livingArrangement: 'independent', childrenPreference: 'want', settlePreference: 'india_any', diet: 'vegetarian',
    smoking: 'never', drinking: 'occasionally', fitness: 'regularly', travel: 'frequently',
    communicationStyle: 'balanced', independenceLevel: 'balanced', financialPhilosophy: 'balanced',
    interests: ['Travel', 'Reading', 'Music'], coreValues: ['honesty', 'family', 'growth'], personalityTraits: ['calm', 'curious'],
    dna: {
      emotional_connection: dna(60), communication: dna(55), family_orientation: dna(50), independence: dna(50),
      career_ambition: dna(70), lifestyle_pace: dna(55), financial_philosophy: dna(45), long_term_aspirations: dna(60),
      shared_interests: dna(60), personal_values: dna(50),
    },
    prefs: prefs({ seekingGenders: [seeking], ageMin: 25, ageMax: 34 }),
    ...extra,
  });

describe('utilities', () => {
  it('overlapScore is case-insensitive and returns shared items', () => {
    const r = overlapScore(['Travel', 'Music'], ['travel', 'cooking']);
    expect(r.shared).toEqual(['Travel']);
    expect(r.score).toBeGreaterThan(0);
    expect(overlapScore([], ['x']).score).toBeNull();
  });
  it('dnaFit uses partner target when present', () => {
    const a = mp({ id: 'a', dna: { communication: dna(20, 80) } });
    const b = mp({ id: 'b', dna: { communication: dna(80) } });
    expect(dnaFit(a, b, 'communication')!.fit).toBe(1);
    const c = mp({ id: 'c', dna: { communication: dna(20) } });
    expect(dnaFit(a, c, 'communication')!.fit).toBeLessThan(0.4);
  });
});

describe('evaluatePair', () => {
  it('scores well-aligned profiles highly and recommends them', () => {
    const r = evaluatePair(base('a', 'female', 'male'), base('b', 'male', 'female'));
    expect(r.eligible).toBe(true);
    expect(r.mutual).toBeGreaterThanOrEqual(80);
    expect(r.recommended).toBe(true);
    expect(r.sharedInterests).toEqual(['Travel', 'Reading', 'Music']);
  });

  it('is mutual: a one-sided fit is not recommended', () => {
    // B is exactly what A wants; A does not match B at all.
    const a = base('a', 'female', 'male', { childrenPreference: 'dont_want', settlePreference: 'abroad', diet: 'non_vegetarian', interests: ['Gaming'], coreValues: ['adventure'],
      dna: { emotional_connection: dna(5), communication: dna(5), family_orientation: dna(5), independence: dna(5), career_ambition: dna(5), lifestyle_pace: dna(95), financial_philosophy: dna(95), long_term_aspirations: dna(95), personal_values: dna(5) },
      prefs: prefs({ seekingGenders: ['male'] }) });
    const b = base('b', 'male', 'female', { prefs: prefs({ seekingGenders: ['female'], coreValues: ['family', 'honesty'], childrenPreferences: ['want'], diets: ['vegetarian'] }) });
    const r = evaluatePair(a, b);
    expect(r.aToB.score).toBeGreaterThan(r.bToA.score);
    expect(r.recommended).toBe(false);
    expect(r.mutual).toBeLessThan(Math.max(r.aToB.score, r.bToA.score));
  });

  it('enforces gender preference in both directions', () => {
    const r = evaluatePair(base('a', 'female', 'male'), base('b', 'female', 'male'));
    expect(r.eligible).toBe(false);
    expect(r.recommended).toBe(false);
    expect(r.mutual).toBeLessThanOrEqual(20);
  });

  it('treats non-negotiables as hard filters and soft preferences as soft', () => {
    const a = base('a', 'female', 'male', { prefs: prefs({ seekingGenders: ['male'], diets: ['vegetarian'], nonNegotiables: ['diet'] }) });
    const b = base('b', 'male', 'female', { diet: 'non_vegetarian' });
    const hard = evaluatePair(a, b);
    expect(hard.eligible).toBe(false);
    expect(hard.aToB.dealbreakers.map((d) => d.field)).toContain('diet');

    const aSoft = base('a', 'female', 'male', { prefs: prefs({ seekingGenders: ['male'], diets: ['vegetarian'] }) });
    const soft = evaluatePair(aSoft, b);
    expect(soft.eligible).toBe(true);
    expect(soft.aToB.score).toBeLessThan(evaluatePair(aSoft, base('b', 'male', 'female')).aToB.score);
  });

  it('missing information lowers confidence, not eligibility', () => {
    const a = base('a', 'female', 'male', { prefs: prefs({ seekingGenders: ['male'], heightMinCm: 175, nonNegotiables: ['height'] }) });
    const b = base('b', 'male', 'female', { heightCm: null });
    const r = evaluatePair(a, b);
    expect(r.eligible).toBe(true);
    expect(r.aToB.missing).toContain('Height range');
    expect(r.aToB.confidence).toBeLessThan(evaluatePair(a, base('b', 'male', 'female', { heightCm: 180 })).aToB.confidence);
  });

  it('age range is respected', () => {
    const a = base('a', 'female', 'male', { prefs: prefs({ seekingGenders: ['male'], ageMin: 30, ageMax: 35, nonNegotiables: ['age'] }) });
    const r = evaluatePair(a, base('b', 'male', 'female', { age: 26 }));
    expect(r.eligible).toBe(false);
  });

  it('location preference is met when candidate is open to relocating', () => {
    const a = base('a', 'female', 'male', { prefs: prefs({ seekingGenders: ['male'], cities: ['Chennai'], nonNegotiables: ['location'] }) });
    expect(evaluatePair(a, base('b', 'male', 'female', { relocation: 'not_open' })).eligible).toBe(false);
    expect(evaluatePair(a, base('b', 'male', 'female', { relocation: 'within_country' })).eligible).toBe(true);
  });

  it('is symmetric in its mutual score', () => {
    const a = base('a', 'female', 'male', { interests: ['Hiking'] });
    const b = base('b', 'male', 'female', { childrenPreference: 'open' });
    expect(evaluatePair(a, b).mutual).toBe(evaluatePair(b, a).mutual);
  });

  it('respects configured weights', () => {
    const a = base('a', 'female', 'male', { interests: ['Chess'] });
    const b = base('b', 'male', 'female', { interests: ['Surfing'] });
    const interestsHeavy = normaliseConfig({ version: 2, weights: { ...DEFAULT_CONFIG.weights, interests: 200 }, thresholds: DEFAULT_CONFIG.thresholds });
    expect(evaluatePair(a, b, interestsHeavy).mutual).toBeLessThan(evaluatePair(a, b).mutual);
  });
});

describe('normaliseConfig', () => {
  it('fills missing and rejects invalid weights', () => {
    const c = normaliseConfig({ version: 3, weights: { values: 50, emotional: -1, bogus: 9 }, thresholds: { min_direction: 60 } });
    expect(c.weights.values).toBe(50);
    expect(c.weights.emotional).toBe(DEFAULT_CONFIG.weights.emotional);
    expect(c.thresholds.min_direction).toBe(60);
    expect(c.thresholds.max_asymmetry).toBe(DEFAULT_CONFIG.thresholds.max_asymmetry);
  });
});

describe('buildExplanation', () => {
  it('produces a viewer-relative, transparent explanation without outcome promises', () => {
    const a = base('a', 'female', 'male', { prefs: prefs({ seekingGenders: ['male'], heightMinCm: 180 }) });
    const b = base('b', 'male', 'female', { heightCm: 172 });
    const pair = evaluatePair(a, b);
    const ex = buildExplanation(pair, 'a', 'b');
    expect(ex.candidateProfileId).toBe('b');
    expect(ex.compatibility.forViewer).toBe(pair.aToB.score);
    expect(ex.dimensions).toHaveLength(9);
    expect(ex.differences.some((d) => d.toLowerCase().includes('height'))).toBe(true);
    expect(ex.mutualPreferenceNotes.length).toBeGreaterThan(0);
    expect(ex.conversationStarters.length).toBeGreaterThan(0);
    expect(ex.disclaimer).toMatch(/not a prediction/i);
    const all = JSON.stringify(ex).toLowerCase();
    expect(all).not.toMatch(/guarantee|soulmate|will marry|perfect match/);

    const flipped = buildExplanation(pair, 'b', 'a');
    expect(flipped.compatibility.forViewer).toBe(pair.bToA.score);
  });
});

describe('evaluateDirection', () => {
  it('handles empty profiles without throwing', () => {
    const r = evaluateDirection(mp({ id: 'x' }), mp({ id: 'y' }));
    expect(r.score).toBe(0);
    expect(r.confidence).toBe(0);
  });
});

describe('hidden sensitive fields (privacy)', () => {
  const target = (hidden: boolean) =>
    base('t', 'male', 'female', { religion: 'Hindu', incomeRange: '25_50l', hiddenFields: hidden ? ['religion', 'income'] : [] });
  const seeker = (religions: string[], minIncome: MatchPreferences['minIncomeRange'], hard = false) =>
    base('s', 'female', 'male', { prefs: prefs({ seekingGenders: ['male'], religions, minIncomeRange: minIncome, nonNegotiables: hard ? ['religion'] : [] }) });

  it('produces identical results regardless of what the viewer probes for', () => {
    const variants = [
      seeker([], null),
      seeker(['Hindu'], null),
      seeker(['Muslim'], null),
      seeker(['Muslim'], null, true),
      seeker([], 'gt_1cr'),
      seeker([], 'lt_3l'),
    ].map((s) => {
      const pair = evaluatePair(s, target(true));
      const ex = buildExplanation(pair, 's', 't', 'fixed');
      return JSON.stringify({ m: pair.mutual, a: pair.aToB.score, c: pair.confidence, e: pair.eligible, ex });
    });
    expect(new Set(variants).size).toBe(1);
  });

  it('never reports hidden fields as missing or unmet', () => {
    const pair = evaluatePair(seeker(['Muslim'], 'gt_1cr', true), target(true));
    const ex = buildExplanation(pair, 's', 't');
    const text = JSON.stringify(ex).toLowerCase();
    expect(text).not.toContain('religion');
    expect(text).not.toContain('income');
    expect(pair.aToB.dealbreakers).toHaveLength(0);
  });

  it('still applies the preference when the field is visible', () => {
    const pair = evaluatePair(seeker(['Muslim'], null, true), target(false));
    expect(pair.eligible).toBe(false);
  });
});
