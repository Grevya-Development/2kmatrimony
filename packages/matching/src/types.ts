import type {
  ChildrenPreference,
  Diet,
  DnaDimension,
  EducationLevel,
  FamilyValues,
  Fitness,
  Gender,
  HabitFrequency,
  IncomeRange,
  LivingArrangement,
  MaritalStatus,
  NonNegotiableField,
  Relocation,
  ScoreDimension,
  SettlePreference,
  Travel,
} from '@2k/shared';

export interface DnaPoint {
  self: number; // 0-100, where the member sits on the spectrum
  target: number | null; // 0-100, where they would like a partner; null = "similar to me"
  importance: number; // 1-5
  flexible: boolean;
}

export interface MatchPreferences {
  seekingGenders: Gender[];
  ageMin: number | null;
  ageMax: number | null;
  heightMinCm: number | null;
  heightMaxCm: number | null;
  maritalStatuses: MaritalStatus[];
  educationLevels: EducationLevel[];
  minIncomeRange: IncomeRange | null;
  countries: string[];
  cities: string[];
  openToRelocatePartner: boolean | null;
  diets: Diet[];
  smokingOk: HabitFrequency[];
  drinkingOk: HabitFrequency[];
  familyValues: FamilyValues[];
  childrenPreferences: ChildrenPreference[];
  livingArrangements: LivingArrangement[];
  personalityTraits: string[];
  coreValues: string[];
  motherTongues: string[];
  religions: string[];
  nonNegotiables: NonNegotiableField[];
}

/** Everything the engine needs about one member. Built server-side from the DB. */
export interface MatchProfile {
  id: string;
  firstName?: string | null;
  age: number | null;
  gender: Gender | null;
  heightCm: number | null;
  maritalStatus: MaritalStatus | null;
  motherTongue: string | null;
  religion: string | null;
  city: string | null;
  country: string | null;
  educationLevel: EducationLevel | null;
  profession: string | null;
  incomeRange: IncomeRange | null;
  relocation: Relocation | null;
  familyValues: FamilyValues | null;
  livingArrangement: LivingArrangement | null;
  childrenPreference: ChildrenPreference | null;
  settlePreference: SettlePreference | null;
  diet: Diet | null;
  smoking: HabitFrequency | null;
  drinking: HabitFrequency | null;
  fitness: Fitness | null;
  travel: Travel | null;
  communicationStyle: string | null;
  independenceLevel: string | null;
  financialPhilosophy: string | null;
  interests: string[];
  coreValues: string[];
  personalityTraits: string[];
  dna: Partial<Record<DnaDimension, DnaPoint>>;
  prefs: MatchPreferences | null;
}

export type Weights = Record<ScoreDimension, number>;

export interface Thresholds {
  min_recommend_mutual: number;
  min_direction: number;
  max_asymmetry: number;
  min_confidence: number;
}

export interface MatchingConfig {
  version: number;
  weights: Weights;
  thresholds: Thresholds;
}

export type PreferenceStatus = 'met' | 'unmet' | 'unknown';

export interface PreferenceCheck {
  field: NonNegotiableField | 'gender' | 'core_values' | 'personality' | 'income' | 'family_values' | 'relocation';
  label: string;
  status: PreferenceStatus;
  hard: boolean;
}

export interface DimensionResult {
  score: number | null; // 0..1, null when not enough data
  notes: string[]; // short factual statements used for explanations
}

export interface DirectionResult {
  seekerId: string;
  candidateId: string;
  score: number; // 0-100
  confidence: number; // 0-100
  dimensions: Record<ScoreDimension, DimensionResult>;
  checks: PreferenceCheck[];
  dealbreakers: PreferenceCheck[];
  missing: string[];
}

export interface PairResult {
  aId: string;
  bId: string;
  aToB: DirectionResult; // how well B fits A
  bToA: DirectionResult; // how well A fits B
  mutual: number; // 0-100
  confidence: number; // 0-100
  eligible: boolean; // no dealbreakers or gender mismatch in either direction
  recommended: boolean; // eligible and passes configured thresholds
  dimensions: Record<ScoreDimension, { mutual: number | null; aToB: number | null; bToA: number | null }>;
  sharedInterests: string[];
  sharedValues: string[];
  configVersion: number;
}
