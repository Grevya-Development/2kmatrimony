import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './env';

loadEnv();

export const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/** Sign in through the real UI with a local test OTP number (code 123456). */
export async function signInWithPhone(page: Page, national: string, next = '/app'): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Mobile number').fill(national);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify & continue' }).click();
}

async function api(page: Page, method: 'POST' | 'PUT', path: string, data: unknown) {
  const res = await page.request.fetch(`/api/v1${path}`, { method, data });
  const body = await res.json().catch(() => ({}));
  expect(res.ok(), `${method} ${path} → ${res.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body.data;
}

const DNA = ['emotional_connection', 'communication', 'family_orientation', 'independence', 'career_ambition', 'lifestyle_pace', 'financial_philosophy', 'long_term_aspirations', 'shared_interests', 'personal_values'];

/**
 * Complete the remaining profile sections through the same API the wizard uses
 * (the wizard's first steps are exercised through the UI in the onboarding test).
 */
export async function completeProfileViaApi(page: Page, p: { firstName: string; gender: 'female' | 'male'; seeking: 'female' | 'male'; dob: string; city: string }) {
  await api(page, 'PUT', '/profile/basics', {
    firstName: p.firstName, lastName: 'Test', nameVisibility: 'first_name', dateOfBirth: p.dob, gender: p.gender, heightCm: 168,
    maritalStatus: 'never_married', motherTongue: 'Kannada', languages: ['English', 'Kannada'], currentCity: p.city, currentCountry: 'IN',
    about: 'I love long walks, good books and thoughtful conversations about the future and family.',
  });
  await api(page, 'PUT', '/profile/education', { items: [{ level: 'masters', qualification: 'M.Tech', institution: 'IISc', isHighest: true }] });
  await api(page, 'PUT', '/profile/career', { profession: 'Software engineer', employmentType: 'employed', incomeRange: '15_25l', relocationWillingness: 'within_country' });
  await api(page, 'PUT', '/profile/family', { familyStructure: 'nuclear', familyValues: 'moderate' });
  await api(page, 'PUT', '/profile/lifestyle', { diet: 'vegetarian', smoking: 'never', drinking: 'occasionally', fitness: 'regularly', travel: 'frequently', hobbies: ['Reading'], interests: ['Travel', 'Music', 'Hiking'] });
  await api(page, 'PUT', '/profile/values', {
    communicationStyle: 'balanced', financialPhilosophy: 'balanced', independenceLevel: 'balanced', childrenPreference: 'want',
    livingArrangement: 'independent', settlePreference: 'india_any', coreValues: ['honesty', 'family', 'growth'], personalityTraits: ['calm', 'curious'],
  });
  await api(page, 'PUT', '/profile/dna', { entries: DNA.map((dimension) => ({ dimension, selfScore: 55, partnerTarget: null, importance: 3, flexible: true, statement: null })) });
  const prefs = await api(page, 'PUT', '/profile/preferences', { seekingGenders: [p.seeking], ageMin: 24, ageMax: 38, nonNegotiables: [] });
  await approveScreening(page);
  return prefs;
}

/**
 * New profiles wait for human screening (production behaviour). E2E tests act
 * as the review team and approve the profile so the journey can continue.
 */
export async function approveScreening(page: Page): Promise<void> {
  const me = await (await page.request.get('/api/v1/me')).json();
  const profileId = me?.data?.profile?.id as string | undefined;
  expect(profileId, 'profile id from /me').toBeTruthy();
  const { data } = await admin().from('profiles').select('status').eq('id', profileId!).single();
  if (data?.status === 'in_review') {
    const { error } = await admin().from('profiles').update({ status: 'active', activated_at: new Date().toISOString(), reviewed_at: new Date().toISOString() }).eq('id', profileId!);
    expect(error).toBeNull();
  }
}

/** Fail the test on uncaught page errors (React crashes, hydration errors). */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  return errors;
}
