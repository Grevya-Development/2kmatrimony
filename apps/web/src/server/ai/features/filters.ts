import { z } from 'zod';
import * as C from '@2k/shared';
import { searchFiltersSchema, type SearchFilters } from '@2k/shared';

/**
 * Loose filter schema for model structured output (no numeric bounds, which
 * structured outputs may not enforce). Every field is re-validated with the
 * canonical searchFiltersSchema by sanitizeFilters before use.
 */
export const AiFiltersSchema = z.object({
  ageMin: z.number().int().optional(),
  ageMax: z.number().int().optional(),
  heightMinCm: z.number().int().optional(),
  heightMaxCm: z.number().int().optional(),
  cities: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  maritalStatuses: z.array(z.enum(C.MARITAL_STATUSES)).optional(),
  educationLevels: z.array(z.enum(C.EDUCATION_LEVELS)).optional(),
  professions: z.array(z.string()).optional(),
  minIncomeRange: z.enum(C.INCOME_RANGES).optional(),
  diets: z.array(z.enum(C.DIETS)).optional(),
  motherTongues: z.array(z.string()).optional(),
  religions: z.array(z.string()).optional(),
  familyValues: z.array(z.enum(C.FAMILY_VALUES)).optional(),
  childrenPreferences: z.array(z.enum(C.CHILDREN_PREFERENCES)).optional(),
  settlePreferences: z.array(z.enum(C.SETTLE_PREFERENCES)).optional(),
  relocation: z.array(z.enum(C.RELOCATION)).optional(),
  interests: z.array(z.string()).optional(),
  coreValues: z.array(z.enum(C.CORE_VALUES)).optional(),
  verifiedOnly: z.boolean().optional(),
  withPhotoOnly: z.boolean().optional(),
});

/** Keep only fields that pass canonical validation; drop empties. */
export function sanitizeFilters(raw: unknown): SearchFilters {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k === 'text' || v === null || v === undefined || (Array.isArray(v) && v.length === 0)) continue;
    const r = searchFiltersSchema.safeParse({ [k]: v });
    if (r.success && (r.data as Record<string, unknown>)[k] !== undefined) out[k] = (r.data as Record<string, unknown>)[k];
  }
  if (typeof out.ageMin === 'number' && typeof out.ageMax === 'number' && out.ageMin > out.ageMax) {
    [out.ageMin, out.ageMax] = [out.ageMax, out.ageMin];
  }
  return out as SearchFilters;
}

export const FILTER_GUIDE = `Allowed filter fields (use only these, canonical values only):
ageMin/ageMax (18-99), heightMinCm/heightMaxCm, cities (city names as written in India, include common alternate spellings e.g. Bengaluru and Bangalore), countries (ISO-2),
maritalStatuses [${C.MARITAL_STATUSES.join(', ')}], educationLevels [${C.EDUCATION_LEVELS.join(', ')}], professions (free text),
minIncomeRange [${C.INCOME_RANGES.join(', ')}], diets [${C.DIETS.join(', ')}], motherTongues, religions (ONLY if the member explicitly asks for it in their own words),
familyValues [${C.FAMILY_VALUES.join(', ')}], childrenPreferences [${C.CHILDREN_PREFERENCES.join(', ')}], settlePreferences [${C.SETTLE_PREFERENCES.join(', ')}],
relocation [${C.RELOCATION.join(', ')}], interests (e.g. ${C.INTEREST_SUGGESTIONS.slice(0, 10).join(', ')}), coreValues [${C.CORE_VALUES.join(', ')}], verifiedOnly, withPhotoOnly.
Qualities that are not fields (e.g. "ambitious", "emotionally mature", "kind") go in softPreferences as short phrases; they are used for ranking only.
Never create filters for caste, skin tone, appearance, health, or any trait the member did not explicitly state, and never infer such traits.`;
