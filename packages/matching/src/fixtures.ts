import type { MatchProfile } from './types';

/**
 * Test/evaluation builder for MatchProfile. Used by unit tests and the AI/engine
 * evaluation harness only — never written to the database.
 */
export function buildMatchProfile(overrides: Partial<MatchProfile> & { id: string }): MatchProfile {
  return {
    age: null, gender: null, heightCm: null, maritalStatus: null, motherTongue: null, religion: null,
    city: null, country: 'IN', educationLevel: null, profession: null, incomeRange: null, relocation: null,
    familyValues: null, livingArrangement: null, childrenPreference: null, settlePreference: null,
    diet: null, smoking: null, drinking: null, fitness: null, travel: null,
    communicationStyle: null, independenceLevel: null, financialPhilosophy: null,
    interests: [], coreValues: [], personalityTraits: [], dna: {}, prefs: null,
    ...overrides,
  };
}
