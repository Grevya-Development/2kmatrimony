/**
 * Mutual compatibility engine.
 *
 * Principles
 *  - Directional: evaluate(A, B) asks "how well does B fit what A asked for?".
 *    A pair is scored in both directions and combined with a geometric mean, so
 *    a strong one-sided fit can never produce a strong mutual score.
 *  - Explicit data only: every signal comes from what members told us. Unknown
 *    values lower *confidence*, never the score.
 *  - Non-negotiables are hard filters; everything else is a soft preference.
 *  - Deterministic and side-effect free so it is unit-testable and auditable.
 */
import {
  EDUCATION_RANK,
  INCOME_RANK,
  NON_NEGOTIABLE_LABELS,
  SCORE_DIMENSIONS,
  DNA_DIMENSION_META,
  type DnaDimension,
  type NonNegotiableField,
  type ScoreDimension,
} from '@2k/shared';
import type {
  DimensionResult,
  DirectionResult,
  MatchingConfig,
  MatchProfile,
  PairResult,
  PreferenceCheck,
  Weights,
} from './types';

export const DEFAULT_CONFIG: MatchingConfig = {
  version: 1,
  weights: { values: 20, emotional: 15, personality: 15, future: 15, lifestyle: 10, family: 10, career: 5, location: 5, interests: 5 },
  thresholds: { min_recommend_mutual: 55, min_direction: 45, max_asymmetry: 30, min_confidence: 30 },
};

const SOFT_MISS = 0.25; // score for an unmet soft preference

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
const normSet = (xs: readonly string[]) => new Set(xs.map(norm).filter(Boolean));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Weighted average of available components; null if none available. */
function combine(parts: { value: number | null; weight: number }[]): number | null {
  let sum = 0;
  let w = 0;
  for (const p of parts) {
    if (p.value === null || Number.isNaN(p.value)) continue;
    sum += p.value * p.weight;
    w += p.weight;
  }
  return w === 0 ? null : clamp01(sum / w);
}

/** Overlap coefficient with light smoothing so tiny lists don't dominate. */
export function overlapScore(a: readonly string[], b: readonly string[]): { score: number | null; shared: string[] } {
  const A = normSet(a);
  const B = normSet(b);
  if (A.size === 0 || B.size === 0) return { score: null, shared: [] };
  const sharedNorm = [...A].filter((x) => B.has(x));
  const display = a.filter((x) => sharedNorm.includes(norm(x)));
  const minSize = Math.min(A.size, B.size);
  const score = clamp01((sharedNorm.length + 0.5) / (minSize + 1.5));
  return { score, shared: [...new Set(display)] };
}

/** Fraction of the seeker's wanted items present in the candidate's list. */
function wantedFraction(wanted: readonly string[], has: readonly string[]): number | null {
  const W = normSet(wanted);
  if (W.size === 0) return null;
  const H = normSet(has);
  if (H.size === 0) return null;
  let hit = 0;
  for (const w of W) if (H.has(w)) hit++;
  return clamp01(0.3 + 0.7 * (hit / W.size));
}

// ---------------------------------------------------------------------------
// Relationship DNA
// ---------------------------------------------------------------------------
/** Fit of candidate's position to seeker's desired position on one DNA spectrum. */
export function dnaFit(seeker: MatchProfile, candidate: MatchProfile, dim: DnaDimension): { fit: number; importance: number } | null {
  const s = seeker.dna[dim];
  const c = candidate.dna[dim];
  if (!s || !c) return null;
  const target = s.target ?? s.self;
  const distance = Math.abs(target - c.self) / 100;
  const slope = s.flexible ? 1.2 : 1.7;
  return { fit: clamp01(1 - distance * slope), importance: s.importance };
}

function dnaComponent(seeker: MatchProfile, candidate: MatchProfile, dim: DnaDimension, baseWeight = 1) {
  const r = dnaFit(seeker, candidate, dim);
  return r ? { value: r.fit, weight: baseWeight * (0.5 + r.importance / 5) } : { value: null, weight: 0 };
}

function dnaNote(seeker: MatchProfile, candidate: MatchProfile, dim: DnaDimension): string | null {
  const r = dnaFit(seeker, candidate, dim);
  if (!r) return null;
  const meta = DNA_DIMENSION_META[dim];
  if (r.fit >= 0.8) return `Similar outlook on ${meta.label.toLowerCase()}`;
  if (r.fit <= 0.4 && r.importance >= 3) return `Different approaches to ${meta.label.toLowerCase()}`;
  return null;
}

// ---------------------------------------------------------------------------
// Compatibility tables for categorical answers (used when no explicit preference)
// ---------------------------------------------------------------------------
const CHILDREN_COMPAT: Record<string, Record<string, number>> = {
  want: { want: 1, have_and_want_more: 1, open: 0.8, dont_want: 0.05, have_no_more: 0.15 },
  have_and_want_more: { want: 1, have_and_want_more: 1, open: 0.8, dont_want: 0.05, have_no_more: 0.15 },
  open: { want: 0.8, have_and_want_more: 0.8, open: 1, dont_want: 0.6, have_no_more: 0.6 },
  dont_want: { want: 0.05, have_and_want_more: 0.05, open: 0.6, dont_want: 1, have_no_more: 0.9 },
  have_no_more: { want: 0.15, have_and_want_more: 0.15, open: 0.6, dont_want: 0.9, have_no_more: 1 },
};
const SETTLE_COMPAT: Record<string, Record<string, number>> = {
  current_city: { current_city: 1, india_any: 0.8, abroad: 0.2, flexible: 0.85 },
  india_any: { current_city: 0.8, india_any: 1, abroad: 0.3, flexible: 0.85 },
  abroad: { current_city: 0.2, india_any: 0.3, abroad: 1, flexible: 0.8 },
  flexible: { current_city: 0.85, india_any: 0.85, abroad: 0.8, flexible: 1 },
};
const LIVING_COMPAT: Record<string, Record<string, number>> = {
  independent: { independent: 1, near_parents: 0.7, with_parents: 0.3, flexible: 0.85 },
  near_parents: { independent: 0.7, near_parents: 1, with_parents: 0.7, flexible: 0.9 },
  with_parents: { independent: 0.3, near_parents: 0.7, with_parents: 1, flexible: 0.8 },
  flexible: { independent: 0.85, near_parents: 0.9, with_parents: 0.8, flexible: 1 },
};
const FAMILY_VALUES_COMPAT: Record<string, Record<string, number>> = {
  traditional: { traditional: 1, moderate: 0.7, liberal: 0.3 },
  moderate: { traditional: 0.7, moderate: 1, liberal: 0.7 },
  liberal: { traditional: 0.3, moderate: 0.7, liberal: 1 },
};
const COMMUNICATION_COMPAT: Record<string, Record<string, number>> = {
  frequent_checkins: { frequent_checkins: 1, balanced: 0.8, space_and_depth: 0.4, direct: 0.7, gentle: 0.8 },
  balanced: { frequent_checkins: 0.8, balanced: 1, space_and_depth: 0.8, direct: 0.8, gentle: 0.85 },
  space_and_depth: { frequent_checkins: 0.4, balanced: 0.8, space_and_depth: 1, direct: 0.7, gentle: 0.8 },
  direct: { frequent_checkins: 0.7, balanced: 0.8, space_and_depth: 0.7, direct: 1, gentle: 0.6 },
  gentle: { frequent_checkins: 0.8, balanced: 0.85, space_and_depth: 0.8, direct: 0.6, gentle: 1 },
};
const INDEPENDENCE_COMPAT: Record<string, Record<string, number>> = {
  very_independent: { very_independent: 1, balanced: 0.75, very_together: 0.3 },
  balanced: { very_independent: 0.75, balanced: 1, very_together: 0.75 },
  very_together: { very_independent: 0.3, balanced: 0.75, very_together: 1 },
};
const FINANCE_COMPAT: Record<string, Record<string, number>> = {
  saver: { saver: 1, balanced: 0.8, investor: 0.85, spender: 0.35, shared_pool: 0.8, separate_finances: 0.7 },
  balanced: { saver: 0.8, balanced: 1, investor: 0.85, spender: 0.65, shared_pool: 0.85, separate_finances: 0.8 },
  investor: { saver: 0.85, balanced: 0.85, investor: 1, spender: 0.45, shared_pool: 0.8, separate_finances: 0.75 },
  spender: { saver: 0.35, balanced: 0.65, investor: 0.45, spender: 1, shared_pool: 0.7, separate_finances: 0.75 },
  shared_pool: { saver: 0.8, balanced: 0.85, investor: 0.8, spender: 0.7, shared_pool: 1, separate_finances: 0.3 },
  separate_finances: { saver: 0.7, balanced: 0.8, investor: 0.75, spender: 0.75, shared_pool: 0.3, separate_finances: 1 },
};
const ORDINAL: Record<string, number> = {
  rarely: 0, sometimes: 1, occasionally: 1, regularly: 2, frequently: 2, athlete: 3, passionate: 3,
};

const table = (t: Record<string, Record<string, number>>, a: string | null, b: string | null): number | null =>
  a && b ? t[a]?.[b] ?? null : null;

const ordinalSimilarity = (a: string | null, b: string | null): number | null => {
  if (!a || !b) return null;
  const x = ORDINAL[a];
  const y = ORDINAL[b];
  if (x === undefined || y === undefined) return null;
  return clamp01(1 - Math.abs(x - y) / 3);
};

// ---------------------------------------------------------------------------
// Preference checks (soft + hard)
// ---------------------------------------------------------------------------
function checkPreferences(seeker: MatchProfile, c: MatchProfile): PreferenceCheck[] {
  const p = seeker.prefs;
  const checks: PreferenceCheck[] = [];
  const hard = (f: NonNegotiableField) => !!p?.nonNegotiables.includes(f);
  const add = (field: PreferenceCheck['field'], label: string, status: PreferenceCheck['status'], isHard: boolean) =>
    checks.push({ field, label, status, hard: isHard });

  // Gender is always a hard requirement when specified.
  if (p && p.seekingGenders.length > 0) {
    add('gender', 'Who they are looking for', c.gender ? (p.seekingGenders.includes(c.gender) ? 'met' : 'unmet') : 'unknown', true);
  }
  if (!p) return checks;

  if (p.ageMin !== null || p.ageMax !== null) {
    const ok = c.age === null ? 'unknown' : (p.ageMin === null || c.age >= p.ageMin) && (p.ageMax === null || c.age <= p.ageMax) ? 'met' : 'unmet';
    add('age', NON_NEGOTIABLE_LABELS.age, ok, hard('age'));
  }
  if (p.heightMinCm !== null || p.heightMaxCm !== null) {
    const ok = c.heightCm === null ? 'unknown'
      : (p.heightMinCm === null || c.heightCm >= p.heightMinCm) && (p.heightMaxCm === null || c.heightCm <= p.heightMaxCm) ? 'met' : 'unmet';
    add('height', NON_NEGOTIABLE_LABELS.height, ok, hard('height'));
  }
  const inList = (list: readonly string[], v: string | null) => (v === null ? 'unknown' : normSet(list).has(norm(v)) ? 'met' : 'unmet') as PreferenceCheck['status'];
  if (p.maritalStatuses.length) add('marital_status', NON_NEGOTIABLE_LABELS.marital_status, inList(p.maritalStatuses, c.maritalStatus), hard('marital_status'));
  if (p.educationLevels.length) {
    // Treat the chosen levels as "at least the lowest chosen level".
    const minRank = Math.min(...p.educationLevels.map((l) => EDUCATION_RANK[l]));
    const status = c.educationLevel === null ? 'unknown' : EDUCATION_RANK[c.educationLevel] >= minRank ? 'met' : 'unmet';
    add('education', NON_NEGOTIABLE_LABELS.education, status, hard('education'));
  }
  if (p.cities.length || p.countries.length) {
    let status: PreferenceCheck['status'] = 'unknown';
    if (c.city || c.country) {
      const cityOk = p.cities.length > 0 && c.city !== null && normSet(p.cities).has(norm(c.city));
      const countryOk = p.countries.length > 0 && c.country !== null && normSet(p.countries).has(norm(c.country)) && p.cities.length === 0;
      const relocates = c.relocation === 'open' || (c.relocation === 'within_country' && (p.countries.length === 0 || p.countries.includes('IN')));
      status = cityOk || countryOk || relocates ? 'met' : 'unmet';
    }
    add('location', NON_NEGOTIABLE_LABELS.location, status, hard('location'));
  }
  if (p.diets.length) add('diet', NON_NEGOTIABLE_LABELS.diet, inList(p.diets, c.diet), hard('diet'));
  if (p.smokingOk.length) add('smoking', NON_NEGOTIABLE_LABELS.smoking, inList(p.smokingOk, c.smoking), hard('smoking'));
  if (p.drinkingOk.length) add('drinking', NON_NEGOTIABLE_LABELS.drinking, inList(p.drinkingOk, c.drinking), hard('drinking'));
  if (p.childrenPreferences.length) add('children', NON_NEGOTIABLE_LABELS.children, inList(p.childrenPreferences, c.childrenPreference), hard('children'));
  if (p.motherTongues.length) add('mother_tongue', NON_NEGOTIABLE_LABELS.mother_tongue, inList(p.motherTongues, c.motherTongue), hard('mother_tongue'));
  const hidden = new Set(c.hiddenFields ?? []);
  if (p.religions.length && !hidden.has('religion')) add('religion', NON_NEGOTIABLE_LABELS.religion, inList(p.religions, c.religion), hard('religion'));
  if (p.livingArrangements.length) add('living_arrangement', NON_NEGOTIABLE_LABELS.living_arrangement, inList(p.livingArrangements, c.livingArrangement), hard('living_arrangement'));
  if (p.familyValues.length) add('family_values', 'Family values', inList(p.familyValues, c.familyValues), false);
  if (p.minIncomeRange && !hidden.has('income')) {
    const want = INCOME_RANK[p.minIncomeRange];
    const has = c.incomeRange ? INCOME_RANK[c.incomeRange] : null;
    add('income', 'Income', want === null || has === null ? 'unknown' : has >= want ? 'met' : 'unmet', false);
  }
  return checks;
}

const checkScore = (checks: PreferenceCheck[], field: PreferenceCheck['field']): number | null => {
  const c = checks.find((x) => x.field === field);
  if (!c || c.status === 'unknown') return null;
  return c.status === 'met' ? 1 : SOFT_MISS;
};

// ---------------------------------------------------------------------------
// Dimension scoring (seeker's perspective)
// ---------------------------------------------------------------------------
function scoreDimensions(s: MatchProfile, c: MatchProfile, checks: PreferenceCheck[]): Record<ScoreDimension, DimensionResult> {
  const notes = (...xs: (string | null)[]) => xs.filter((x): x is string => !!x);
  const prefs = s.prefs;

  // VALUES
  const valuesWanted = prefs?.coreValues.length ? wantedFraction(prefs.coreValues, c.coreValues) : null;
  const valuesShared = overlapScore(s.coreValues, c.coreValues);
  const values: DimensionResult = {
    score: combine([
      { value: valuesWanted, weight: 1.5 },
      { value: valuesShared.score, weight: 1 },
      dnaComponent(s, c, 'personal_values', 1.2),
      dnaComponent(s, c, 'financial_philosophy', 0.8),
      { value: table(FINANCE_COMPAT, s.financialPhilosophy, c.financialPhilosophy), weight: 0.6 },
    ]),
    notes: notes(
      valuesShared.shared.length ? `Both value ${listify(valuesShared.shared)}` : null,
      dnaNote(s, c, 'personal_values'),
      dnaNote(s, c, 'financial_philosophy'),
    ),
  };

  // EMOTIONAL
  const emotional: DimensionResult = {
    score: combine([dnaComponent(s, c, 'emotional_connection', 1)]),
    notes: notes(dnaNote(s, c, 'emotional_connection')),
  };

  // PERSONALITY & COMMUNICATION
  const traitsWanted = prefs?.personalityTraits.length ? wantedFraction(prefs.personalityTraits, c.personalityTraits) : null;
  const personality: DimensionResult = {
    score: combine([
      dnaComponent(s, c, 'communication', 1.2),
      dnaComponent(s, c, 'independence', 1),
      { value: traitsWanted, weight: 1 },
      { value: table(COMMUNICATION_COMPAT, s.communicationStyle, c.communicationStyle), weight: 0.8 },
      { value: table(INDEPENDENCE_COMPAT, s.independenceLevel, c.independenceLevel), weight: 0.6 },
    ]),
    notes: notes(dnaNote(s, c, 'communication'), dnaNote(s, c, 'independence')),
  };

  // FUTURE
  const childrenPref = checkScore(checks, 'children');
  const childrenTable = table(CHILDREN_COMPAT, s.childrenPreference, c.childrenPreference);
  const settle = table(SETTLE_COMPAT, s.settlePreference, c.settlePreference);
  const future: DimensionResult = {
    score: combine([
      { value: childrenPref ?? childrenTable, weight: 1.6 },
      { value: settle, weight: 1 },
      dnaComponent(s, c, 'long_term_aspirations', 1),
    ]),
    notes: notes(
      childrenTable !== null && childrenTable >= 0.9 ? 'Aligned on children' : null,
      childrenTable !== null && childrenTable <= 0.2 ? 'Different hopes about children' : null,
      settle !== null && settle >= 0.95 ? 'Similar plans for where to settle' : null,
      settle !== null && settle <= 0.3 ? 'Different plans for where to settle' : null,
      dnaNote(s, c, 'long_term_aspirations'),
    ),
  };

  // LIFESTYLE
  const dietSim = s.diet && c.diet ? (s.diet === c.diet ? 1 : s.diet === 'flexible' || c.diet === 'flexible' ? 0.8 : 0.5) : null;
  const lifestyle: DimensionResult = {
    score: combine([
      { value: checkScore(checks, 'diet') ?? dietSim, weight: 1 },
      { value: checkScore(checks, 'smoking'), weight: 1 },
      { value: checkScore(checks, 'drinking'), weight: 1 },
      dnaComponent(s, c, 'lifestyle_pace', 1),
      { value: ordinalSimilarity(s.fitness, c.fitness), weight: 0.5 },
      { value: ordinalSimilarity(s.travel, c.travel), weight: 0.5 },
    ]),
    notes: notes(
      s.diet && s.diet === c.diet ? 'Same food preferences' : null,
      s.travel && c.travel && ordinalSimilarity(s.travel, c.travel) === 1 ? 'Similar appetite for travel' : null,
      dnaNote(s, c, 'lifestyle_pace'),
    ),
  };

  // FAMILY
  const livingPref = checkScore(checks, 'living_arrangement');
  const family: DimensionResult = {
    score: combine([
      { value: checkScore(checks, 'family_values') ?? table(FAMILY_VALUES_COMPAT, s.familyValues, c.familyValues), weight: 1 },
      { value: livingPref ?? table(LIVING_COMPAT, s.livingArrangement, c.livingArrangement), weight: 1 },
      dnaComponent(s, c, 'family_orientation', 1.2),
    ]),
    notes: notes(
      s.familyValues && s.familyValues === c.familyValues ? `Both describe their family values as ${s.familyValues}` : null,
      dnaNote(s, c, 'family_orientation'),
    ),
  };

  // CAREER
  const career: DimensionResult = {
    score: combine([
      { value: checkScore(checks, 'education'), weight: 1 },
      { value: checkScore(checks, 'income'), weight: 0.6 },
      dnaComponent(s, c, 'career_ambition', 1.2),
    ]),
    notes: notes(dnaNote(s, c, 'career_ambition')),
  };

  // LOCATION
  let locationScore = checkScore(checks, 'location');
  if (locationScore === null && s.city && c.city) {
    const sameCity = norm(s.city) === norm(c.city);
    const sameCountry = norm(s.country) === norm(c.country);
    const flexible = c.relocation === 'open' || s.relocation === 'open' || (sameCountry && (c.relocation === 'within_country' || s.relocation === 'within_country'));
    locationScore = sameCity ? 1 : flexible ? 0.75 : sameCountry ? 0.55 : 0.3;
  }
  const location: DimensionResult = {
    score: locationScore,
    notes: notes(
      s.city && c.city && norm(s.city) === norm(c.city) ? `Both live in ${c.city}` : null,
      c.relocation === 'open' ? 'Open to relocating' : null,
    ),
  };

  // INTERESTS (weighted by how much the seeker wants shared hobbies)
  const shared = overlapScore(s.interests, c.interests);
  const interests: DimensionResult = {
    score: shared.score,
    notes: notes(shared.shared.length ? `Shared interests: ${listify(shared.shared.slice(0, 4))}` : null),
  };

  return { values, emotional, personality, future, lifestyle, family, career, location, interests };
}

function listify(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** Interests weight scales with how much the seeker says shared hobbies matter. */
function effectiveWeights(seeker: MatchProfile, weights: Weights): Weights {
  const w = { ...weights };
  const si = seeker.dna.shared_interests;
  if (si) w.interests = weights.interests * (0.5 + si.self / 100);
  return w;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function evaluateDirection(seeker: MatchProfile, candidate: MatchProfile, config: MatchingConfig = DEFAULT_CONFIG): DirectionResult {
  const checks = checkPreferences(seeker, candidate);
  const dimensions = scoreDimensions(seeker, candidate, checks);
  const weights = effectiveWeights(seeker, config.weights);

  let total = 0;
  let wSum = 0;
  let wAll = 0;
  for (const d of SCORE_DIMENSIONS) {
    const w = Math.max(0, weights[d] ?? 0);
    wAll += w;
    const sc = dimensions[d].score;
    if (sc === null) continue;
    total += sc * w;
    wSum += w;
  }

  const dealbreakers = checks.filter((c) => c.hard && c.status === 'unmet');
  const missing = checks.filter((c) => c.status === 'unknown').map((c) => c.label);
  const hardUnknown = checks.filter((c) => c.hard && c.status === 'unknown').length;

  // Soft preference satisfaction nudges the score (±10%) without dominating it.
  const soft = checks.filter((c) => !c.hard && c.status !== 'unknown');
  const softRate = soft.length ? soft.filter((c) => c.status === 'met').length / soft.length : null;

  let score = wSum === 0 ? 0 : total / wSum;
  if (softRate !== null) score = clamp01(score * (0.9 + 0.2 * softRate));
  if (dealbreakers.length) score = Math.min(score, 0.2);

  const coverage = wAll === 0 ? 0 : wSum / wAll;
  const confidence = clamp01(coverage - hardUnknown * 0.08);

  return {
    seekerId: seeker.id,
    candidateId: candidate.id,
    score: Math.round(score * 100),
    confidence: Math.round(confidence * 100),
    dimensions,
    checks,
    dealbreakers,
    missing,
  };
}

export function evaluatePair(a: MatchProfile, b: MatchProfile, config: MatchingConfig = DEFAULT_CONFIG): PairResult {
  const aToB = evaluateDirection(a, b, config);
  const bToA = evaluateDirection(b, a, config);
  const genderOk = (r: DirectionResult) => !r.checks.some((c) => c.field === 'gender' && c.status === 'unmet');
  const eligible = aToB.dealbreakers.length === 0 && bToA.dealbreakers.length === 0 && genderOk(aToB) && genderOk(bToA);

  // Geometric mean: one-sided fit cannot carry the pair.
  const mutualRaw = Math.sqrt((aToB.score / 100) * (bToA.score / 100));
  const mutual = eligible ? Math.round(mutualRaw * 100) : Math.min(Math.round(mutualRaw * 100), 20);
  const confidence = Math.round((aToB.confidence + bToA.confidence) / 2);

  const t = config.thresholds;
  const recommended =
    eligible &&
    mutual >= t.min_recommend_mutual &&
    Math.min(aToB.score, bToA.score) >= t.min_direction &&
    Math.abs(aToB.score - bToA.score) <= t.max_asymmetry &&
    confidence >= t.min_confidence;

  const dimensions = Object.fromEntries(
    SCORE_DIMENSIONS.map((d) => {
      const x = aToB.dimensions[d].score;
      const y = bToA.dimensions[d].score;
      const m = x !== null && y !== null ? Math.round(Math.sqrt(x * y) * 100) : x !== null ? Math.round(x * 100) : y !== null ? Math.round(y * 100) : null;
      return [d, { mutual: m, aToB: x === null ? null : Math.round(x * 100), bToA: y === null ? null : Math.round(y * 100) }];
    }),
  ) as PairResult['dimensions'];

  return {
    aId: a.id,
    bId: b.id,
    aToB,
    bToA,
    mutual,
    confidence,
    eligible,
    recommended,
    dimensions,
    sharedInterests: overlapScore(a.interests, b.interests).shared,
    sharedValues: overlapScore(a.coreValues, b.coreValues).shared,
    configVersion: config.version,
  };
}

/** Normalise weights from admin config (ignores unknown keys, negative values). */
export function normaliseConfig(raw: { version: number; weights: unknown; thresholds: unknown }): MatchingConfig {
  const w = (raw.weights ?? {}) as Record<string, unknown>;
  const t = (raw.thresholds ?? {}) as Record<string, unknown>;
  const weights = Object.fromEntries(
    SCORE_DIMENSIONS.map((d) => [d, typeof w[d] === 'number' && (w[d] as number) >= 0 ? (w[d] as number) : DEFAULT_CONFIG.weights[d]]),
  ) as Weights;
  const num = (k: keyof MatchingConfig['thresholds']) => (typeof t[k] === 'number' ? (t[k] as number) : DEFAULT_CONFIG.thresholds[k]);
  return {
    version: raw.version,
    weights,
    thresholds: {
      min_recommend_mutual: num('min_recommend_mutual'),
      min_direction: num('min_direction'),
      max_asymmetry: num('max_asymmetry'),
      min_confidence: num('min_confidence'),
    },
  };
}
