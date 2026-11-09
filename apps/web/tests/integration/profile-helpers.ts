import { admin, call, createTestUser, request, type TestUser } from './helpers';
import { POST as startProfile } from '@/app/api/v1/profile/route';
import { PUT as putBasics } from '@/app/api/v1/profile/basics/route';
import { PUT as putValues } from '@/app/api/v1/profile/values/route';
import { PUT as putDna } from '@/app/api/v1/profile/dna/route';
import { PUT as putPrefs } from '@/app/api/v1/profile/preferences/route';
import { DNA_DIMENSIONS } from '@2k/shared';

/** Workstream A test helpers: users created here are tracked for targeted cleanup. */
export const createdUsers: string[] = [];

export async function newUser(label: string): Promise<TestUser> {
  const u = await createTestUser(label);
  createdUsers.push(u.userId);
  return u;
}

export async function cleanupCreated(): Promise<void> {
  for (const id of createdUsers.splice(0)) await admin().auth.admin.deleteUser(id).catch(() => undefined);
}

export async function startedUser(label: string, aiProcessing = false): Promise<TestUser> {
  const u = await newUser(label);
  const r = await call(startProfile, request('/api/v1/profile', { token: u.token, body: { createdFor: 'self', consents: { terms: true, privacy: true, aiProcessing } } }));
  if (r.status !== 201) throw new Error(`start failed ${r.status} ${JSON.stringify(r.body)}`);
  return u;
}

export const basics = {
  firstName: 'Ananya', lastName: 'Rao', nameVisibility: 'first_name', dateOfBirth: '1996-04-12', gender: 'female',
  heightCm: 165, maritalStatus: 'never_married', motherTongue: 'Kannada', languages: ['English', 'Kannada'],
  religion: 'Example faith', currentCity: 'Bengaluru', currentCountry: 'IN', about: 'I enjoy long walks, good books and building things with people I care about.',
};

export async function completeRequired(u: TestUser): Promise<void> {
  const steps: [typeof putBasics, string, unknown][] = [
    [putBasics, 'basics', basics],
    [putValues, 'values', { childrenPreference: 'want', settlePreference: 'india_any', coreValues: ['honesty', 'family'], personalityTraits: ['calm'] }],
    [putDna, 'dna', { entries: DNA_DIMENSIONS.map((d) => ({ dimension: d, selfScore: 50, partnerTarget: null, importance: 3, flexible: true })) }],
    [putPrefs, 'preferences', { seekingGenders: ['male'], ageMin: 27, ageMax: 35 }],
  ];
  for (const [h, name, body] of steps) {
    const r = await call(h, request(`/api/v1/profile/${name}`, { token: u.token, method: 'PUT', body }));
    if (r.status !== 200) throw new Error(`${name} failed ${r.status} ${JSON.stringify(r.body)}`);
  }
}

/** 1x1 transparent PNG. */
export const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
