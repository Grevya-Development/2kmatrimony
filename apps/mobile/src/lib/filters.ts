/** Search filter helpers (pure — unit tested). */
import { ADVANCED_FILTER_KEYS, type SearchFilters } from '@2k/shared';

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0);

/** Drop empty values so requests stay minimal and comparable. */
export function serializeFilters(f: SearchFilters): SearchFilters {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (isEmpty(v)) continue;
    out[k] = typeof v === 'string' ? v.trim() : v;
  }
  if (typeof out.text === 'string' && out.text === '') delete out.text;
  return out as SearchFilters;
}

export function activeFilterCount(f: SearchFilters): number {
  return Object.keys(serializeFilters(f)).length;
}

export function usesAdvancedFilters(f: SearchFilters): (keyof SearchFilters)[] {
  const s = serializeFilters(f);
  return ADVANCED_FILTER_KEYS.filter((k) => k in s);
}

const pretty = (s: string) => s.replace(/_/g, ' ');

/** Human-readable chips for applied filters (removable). */
export function filterChips(f: SearchFilters): { key: keyof SearchFilters; label: string }[] {
  const s = serializeFilters(f);
  const chips: { key: keyof SearchFilters; label: string }[] = [];
  if (s.ageMin !== undefined || s.ageMax !== undefined) chips.push({ key: 'ageMin', label: `Age ${s.ageMin ?? 18}–${s.ageMax ?? 99}` });
  if (s.heightMinCm !== undefined || s.heightMaxCm !== undefined) chips.push({ key: 'heightMinCm', label: `Height ${s.heightMinCm ?? 120}–${s.heightMaxCm ?? 230} cm` });
  for (const [key, val] of Object.entries(s) as [keyof SearchFilters, unknown][]) {
    if (['ageMin', 'ageMax', 'heightMinCm', 'heightMaxCm'].includes(key)) continue;
    if (Array.isArray(val)) chips.push({ key, label: val.map((x) => pretty(String(x))).join(', ') });
    else if (val === true) chips.push({ key, label: key === 'verifiedOnly' ? 'Verified only' : key === 'withPhotoOnly' ? 'With photo' : pretty(key) });
    else if (typeof val === 'string') chips.push({ key, label: key === 'text' ? `“${val}”` : pretty(val) });
  }
  return chips;
}

export function removeFilter(f: SearchFilters, key: keyof SearchFilters): SearchFilters {
  const next = { ...f };
  delete next[key];
  if (key === 'ageMin') delete next.ageMax;
  if (key === 'heightMinCm') delete next.heightMaxCm;
  return serializeFilters(next);
}
