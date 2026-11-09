import { describe, expect, it } from 'vitest';
import { activeFilterCount, filterChips, removeFilter, serializeFilters, usesAdvancedFilters } from './filters';

describe('filters', () => {
  it('serializes away empty values', () => {
    expect(serializeFilters({ ageMin: 25, cities: [], text: '  ', verifiedOnly: false, diets: ['vegetarian'] })).toEqual({ ageMin: 25, diets: ['vegetarian'] });
  });
  it('counts and detects advanced filters', () => {
    const f = { ageMin: 25, ageMax: 32, verifiedOnly: true, professions: ['Engineer'] };
    expect(activeFilterCount(f)).toBe(4);
    expect(usesAdvancedFilters(f).sort()).toEqual(['professions', 'verifiedOnly']);
    expect(usesAdvancedFilters({ ageMin: 20 })).toEqual([]);
  });
  it('produces readable chips and removes paired keys', () => {
    const f = { ageMin: 25, ageMax: 32, cities: ['Bengaluru', 'Chennai'], withPhotoOnly: true };
    const chips = filterChips(f);
    expect(chips.map((c) => c.label)).toEqual(['Age 25–32', 'Bengaluru, Chennai', 'With photo']);
    expect(removeFilter(f, 'ageMin')).toEqual({ cities: ['Bengaluru', 'Chennai'], withPhotoOnly: true });
  });
});
