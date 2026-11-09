import 'server-only';
import { ageFromDob, type DnaDimension } from '@2k/shared';
import type { MatchPreferences, MatchProfile } from '@2k/matching';
import { highestEducation, type ProfileBundle } from './load';

/** Convert a DB bundle into the matching engine's input. Explicit data only. */
export function toMatchProfile(b: ProfileBundle): MatchProfile {
  const p = b.profile;
  const edu = highestEducation(b);
  const prefs: MatchPreferences | null = b.prefs
    ? {
        seekingGenders: b.prefs.seeking_genders as MatchPreferences['seekingGenders'],
        ageMin: b.prefs.age_min,
        ageMax: b.prefs.age_max,
        heightMinCm: b.prefs.height_min_cm,
        heightMaxCm: b.prefs.height_max_cm,
        maritalStatuses: b.prefs.marital_statuses as MatchPreferences['maritalStatuses'],
        educationLevels: b.prefs.education_levels as MatchPreferences['educationLevels'],
        minIncomeRange: b.prefs.min_income_range as MatchPreferences['minIncomeRange'],
        countries: b.prefs.countries,
        cities: b.prefs.cities,
        openToRelocatePartner: b.prefs.open_to_relocate_partner,
        diets: b.prefs.diets as MatchPreferences['diets'],
        smokingOk: b.prefs.smoking_ok as MatchPreferences['smokingOk'],
        drinkingOk: b.prefs.drinking_ok as MatchPreferences['drinkingOk'],
        familyValues: b.prefs.family_values as MatchPreferences['familyValues'],
        childrenPreferences: b.prefs.children_preferences as MatchPreferences['childrenPreferences'],
        livingArrangements: b.prefs.living_arrangements as MatchPreferences['livingArrangements'],
        personalityTraits: b.prefs.personality_traits,
        coreValues: b.prefs.core_values,
        motherTongues: b.prefs.mother_tongues,
        religions: b.prefs.religions,
        nonNegotiables: b.prefs.non_negotiables as MatchPreferences['nonNegotiables'],
      }
    : null;

  const dna: MatchProfile['dna'] = {};
  for (const d of b.dna) {
    dna[d.dimension as DnaDimension] = { self: d.self_score, target: d.partner_target, importance: d.importance, flexible: d.flexible };
  }

  return {
    id: p.id,
    firstName: p.first_name,
    age: ageFromDob(p.date_of_birth),
    gender: p.gender as MatchProfile['gender'],
    heightCm: p.height_cm,
    maritalStatus: p.marital_status as MatchProfile['maritalStatus'],
    motherTongue: p.mother_tongue,
    religion: p.religion,
    city: p.current_city,
    country: p.current_country,
    educationLevel: (edu?.level ?? null) as MatchProfile['educationLevel'],
    profession: b.career?.profession ?? null,
    incomeRange: (b.career?.income_range ?? null) as MatchProfile['incomeRange'],
    relocation: (b.career?.relocation_willingness ?? null) as MatchProfile['relocation'],
    familyValues: (b.family?.family_values ?? null) as MatchProfile['familyValues'],
    livingArrangement: (b.values?.living_arrangement ?? null) as MatchProfile['livingArrangement'],
    childrenPreference: (b.values?.children_preference ?? null) as MatchProfile['childrenPreference'],
    settlePreference: (b.values?.settle_preference ?? null) as MatchProfile['settlePreference'],
    diet: (b.lifestyle?.diet ?? null) as MatchProfile['diet'],
    smoking: (b.lifestyle?.smoking ?? null) as MatchProfile['smoking'],
    drinking: (b.lifestyle?.drinking ?? null) as MatchProfile['drinking'],
    fitness: (b.lifestyle?.fitness ?? null) as MatchProfile['fitness'],
    travel: (b.lifestyle?.travel ?? null) as MatchProfile['travel'],
    communicationStyle: b.values?.communication_style ?? null,
    independenceLevel: b.values?.independence_level ?? null,
    financialPhilosophy: b.values?.financial_philosophy ?? null,
    interests: [...(b.lifestyle?.interests ?? []), ...(b.lifestyle?.hobbies ?? [])],
    coreValues: p.core_values,
    personalityTraits: p.personality_traits,
    dna,
    prefs,
  };
}

const audienceAllows = (audience: string | null | undefined, connected: boolean) =>
  audience === 'members' || (audience === 'connections' && connected);

/**
 * Viewer-relative privacy mask for the matching engine. Attributes the member
 * hides from this viewer are nulled AND declared hidden, so the engine skips
 * them entirely (no met/unmet/missing signal a viewer could probe).
 * Mirrors the visibility rules in projection.ts.
 */
export function maskForViewer(mp: MatchProfile, b: ProfileBundle, connected: boolean): MatchProfile {
  const sensitiveOk = audienceAllows(b.profile.sensitive_fields_visibility, connected);
  const incomeOk = sensitiveOk && audienceAllows(b.career?.income_visibility ?? 'connections', connected);
  const hidden: NonNullable<MatchProfile['hiddenFields']> = [];
  const out: MatchProfile = { ...mp };
  if (!sensitiveOk) {
    out.religion = null;
    hidden.push('religion');
  }
  if (!incomeOk) {
    out.incomeRange = null;
    hidden.push('income');
  }
  out.hiddenFields = hidden;
  return out;
}
