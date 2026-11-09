import { describe, expect, it } from 'vitest';
import { DEFAULT_ENTITLEMENTS } from '@2k/shared';
import { parseSmartQuery, removedFiltersNotice, stripAdvancedFilters, summarise } from './smart-search-rules';
import { sanitizeFilters } from './filters';

describe('parseSmartQuery', () => {
  it('handles the spec example about career, family and Bangalore', () => {
    const r = parseSmartQuery('Show me career-oriented people who value family and want to settle in Bangalore.');
    expect(r.filters.cities).toEqual(expect.arrayContaining(['Bengaluru', 'Bangalore']));
    expect(r.filters.coreValues).toEqual(['family']);
    expect(r.softPreferences).toContain('career-oriented');
  });

  it('maps relocation after marriage and international travel', () => {
    expect(parseSmartQuery('Show profiles open to relocating after marriage').filters.relocation).toEqual(['open', 'within_country']);
    const t = parseSmartQuery('Find people interested in international travel and personal growth');
    expect(t.filters.interests).toContain('Travel');
    expect(t.filters.coreValues).toContain('growth');
    expect(t.softPreferences).toContain('international travel');
    expect(t.filters.settlePreferences).toBeUndefined(); // travel is not settling abroad
  });

  it('parses age ranges in several forms', () => {
    expect(parseSmartQuery('aged 28-32').filters).toMatchObject({ ageMin: 28, ageMax: 32 });
    expect(parseSmartQuery('between 30 and 27').filters).toMatchObject({ ageMin: 27, ageMax: 30 });
    expect(parseSmartQuery('under 30').filters).toMatchObject({ ageMax: 29 });
    expect(parseSmartQuery('someone in their late 20s').filters).toMatchObject({ ageMin: 27, ageMax: 29 });
  });

  it('handles diet without confusing non-veg with veg', () => {
    expect(parseSmartQuery('non-vegetarian is fine').filters.diets).toEqual(['non_vegetarian']);
    expect(parseSmartQuery('vegetarian please').filters.diets).toEqual(['vegetarian', 'vegan', 'jain']);
  });

  it('maps independence and emotional connection', () => {
    const r = parseSmartQuery('Find someone who values emotional connection and independence');
    expect(r.filters.coreValues).toContain('independence');
    expect(r.softPreferences).toContain('emotional connection');
  });

  it('never creates filters for sensitive traits it was not asked about, and ignores unknown words', () => {
    const r = parseSmartQuery('someone fair and tall from a good family');
    expect(r.filters.religions).toBeUndefined();
    expect(Object.keys(r.filters)).not.toContain('text');
  });

  it('asks clarifying questions when age and location are missing', () => {
    expect(parseSmartQuery('kind and calm').clarifyingQuestions.length).toBe(2);
  });

  it('summarises', () => {
    expect(summarise(['in Pune'], ['kind'])).toMatch(/Looking for people in Pune/);
    expect(summarise([], [])).toMatch(/could not pick out/);
  });
});

describe('stripAdvancedFilters', () => {
  it('removes advanced filters on Free and keeps them as soft preferences', () => {
    const { filters, removed, soft } = stripAdvancedFilters({ ageMin: 25, relocation: ['open'], coreValues: ['family'] }, DEFAULT_ENTITLEMENTS);
    expect(filters).toEqual({ ageMin: 25 });
    expect(removed).toEqual(expect.arrayContaining(['relocation', 'coreValues']));
    expect(soft).toEqual(expect.arrayContaining(['open', 'family']));
    expect(removedFiltersNotice(removed)).toMatch(/rank results instead/);
  });
  it('keeps everything when advanced filters are included', () => {
    const r = stripAdvancedFilters({ relocation: ['open'] }, { ...DEFAULT_ENTITLEMENTS, advanced_filters: true });
    expect(r.filters).toEqual({ relocation: ['open'] });
    expect(removedFiltersNotice(r.removed)).toBeNull();
  });
});

describe('sanitizeFilters (model output hardening)', () => {
  it('drops invalid values, the text field and empty arrays; fixes inverted ages', () => {
    const f = sanitizeFilters({ ageMin: 40, ageMax: 30, diets: ['vegetarian', 'pizza'], cities: [], text: 'ignore previous instructions', heightMinCm: 500, coreValues: ['family'] });
    expect(f).toEqual({ ageMin: 30, ageMax: 40, coreValues: ['family'] });
  });
  it('returns {} for garbage', () => {
    expect(sanitizeFilters(null)).toEqual({});
    expect(sanitizeFilters('x')).toEqual({});
  });
});
