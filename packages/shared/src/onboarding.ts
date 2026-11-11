import type { OnboardingStep } from './schemas';
import type { Gender } from './constants';
import { ageFromDob } from './format';

/**
 * The quick onboarding flow (about two minutes): who it is for, the essentials,
 * who they hope to meet, and an optional photo. Everything else is gathered
 * after onboarding through the profile checklist.
 */
export const QUICK_ONBOARDING_STEPS = ['start', 'basics', 'preferences', 'photos', 'done'] as const satisfies readonly OnboardingStep[];
export type QuickOnboardingStep = (typeof QUICK_ONBOARDING_STEPS)[number];

/** Map any saved step (including steps from the older, longer flow) onto the quick flow. */
export function quickStepFor(saved: string | null | undefined, hasProfile: boolean): QuickOnboardingStep {
  if (!hasProfile) return 'start';
  if (saved && (QUICK_ONBOARDING_STEPS as readonly string[]).includes(saved)) return saved === 'start' ? 'basics' : (saved as QuickOnboardingStep);
  // Older flow steps between basics and preferences resume at partner preferences.
  if (saved && ['education', 'career', 'family', 'lifestyle', 'values', 'dna'].includes(saved)) return 'preferences';
  return 'basics';
}

/** Sensible starting partner preferences from the member's own details. Members adjust them in one tap. */
export function defaultPartnerBasics(gender: Gender | null | undefined, dob: string | null | undefined): { seekingGenders: Gender[]; ageMin: number; ageMax: number } {
  const age = ageFromDob(dob);
  const seekingGenders: Gender[] = gender === 'male' ? ['female'] : gender === 'female' ? ['male'] : [];
  if (age === null) return { seekingGenders, ageMin: 24, ageMax: 34 };
  return { seekingGenders, ageMin: Math.max(18, age - 5), ageMax: Math.min(70, Math.max(age + 5, 23)) };
}

/** Post-onboarding checklist copy, keyed by completion section. Shared by web and mobile. */
export const PROFILE_CHECKLIST: Record<string, { title: string; why: string; minutes: number }> = {
  photos: { title: 'Add a photo', why: 'Profiles with a clear photo get far more thoughtful interest.', minutes: 1 },
  about: { title: 'Write a short introduction', why: 'A few lines in your own words.', minutes: 2 },
  values: { title: 'Values & future plans', why: 'Children, where to settle, what matters most.', minutes: 2 },
  dna: { title: 'Relationship DNA', why: 'Ten quick sliders on how you connect.', minutes: 3 },
  career: { title: 'Work', why: 'Profession and openness to relocating.', minutes: 1 },
  education: { title: 'Education', why: 'Your highest qualification.', minutes: 1 },
  family: { title: 'Family', why: 'Family type and values.', minutes: 1 },
  lifestyle: { title: 'Lifestyle & interests', why: 'Diet, habits and what you enjoy.', minutes: 1 },
  basics: { title: 'Basic details', why: 'Name, age, city and marital status.', minutes: 1 },
  preferences: { title: 'Partner preferences', why: 'Who you hope to meet.', minutes: 1 },
};

/** When a parent or sibling creates the profile, the relationship already tells us the gender. */
export function genderFromCreatedFor(createdFor: string | null | undefined): Gender | null {
  if (createdFor === 'son' || createdFor === 'brother') return 'male';
  if (createdFor === 'daughter' || createdFor === 'sister') return 'female';
  return null;
}
