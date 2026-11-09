import { randomUUID } from 'node:crypto';
import { admin, createTestUser, type TestUser } from './helpers';

export interface SeededMember extends TestUser { profileId: string }

const dna = (profileId: string, base: number) =>
  ['emotional_connection', 'communication', 'family_orientation', 'independence', 'career_ambition', 'lifestyle_pace', 'financial_philosophy', 'long_term_aspirations', 'shared_interests', 'personal_values'].map((dimension) => ({
    profile_id: profileId, dimension, self_score: base, importance: 3, flexible: true, source: 'explicit',
  }));

/** Create a user with a complete, active, discoverable profile (test data only). */
export async function seedMember(opts: { label: string; gender: 'female' | 'male'; seeking: 'female' | 'male'; city?: string; firstName?: string; interests?: string[]; profession?: string; messagingPolicy?: string; verified?: boolean; dnaBase?: number }): Promise<SeededMember> {
  const user = await createTestUser(opts.label);
  const a = admin();
  const now = new Date().toISOString();
  const { data: p, error } = await a.from('profiles').insert({
    owner_user_id: user.userId,
    first_name: opts.firstName ?? `T${randomUUID().slice(0, 4)}`,
    last_name: 'Test',
    date_of_birth: '1996-05-10',
    gender: opts.gender,
    height_cm: 170,
    marital_status: 'never_married',
    mother_tongue: 'Kannada',
    current_city: opts.city ?? 'Bengaluru',
    current_country: 'IN',
    about: 'Integration test member who enjoys long walks, books and thoughtful conversations.',
    core_values: ['honesty', 'family', 'growth'],
    personality_traits: ['calm', 'curious'],
    status: 'active',
    visibility: 'members',
    messaging_policy: opts.messagingPolicy ?? 'connections',
    is_identity_verified: opts.verified ?? false,
    activated_at: now,
    last_active_at: now,
    search_text: `${opts.city ?? 'Bengaluru'} ${opts.profession ?? 'Engineer'} ${(opts.interests ?? ['Travel', 'Reading']).join(' ')}`,
  }).select('id').single();
  if (error || !p) throw error ?? new Error('profile insert failed');
  const id = p.id;
  await Promise.all([
    a.from('profile_education').insert({ profile_id: id, level: 'masters', qualification: 'M.Tech', is_highest: true }),
    a.from('profile_career').insert({ profile_id: id, profession: opts.profession ?? 'Engineer', income_range: '15_25l', relocation_willingness: 'within_country' }),
    a.from('profile_family').insert({ profile_id: id, family_structure: 'nuclear', family_values: 'moderate' }),
    a.from('profile_lifestyle').insert({ profile_id: id, diet: 'vegetarian', smoking: 'never', drinking: 'occasionally', fitness: 'regularly', travel: 'frequently', interests: opts.interests ?? ['Travel', 'Reading'], hobbies: ['Music'] }),
    a.from('profile_values').insert({ profile_id: id, communication_style: 'balanced', independence_level: 'balanced', financial_philosophy: 'balanced', children_preference: 'want', living_arrangement: 'independent', settle_preference: 'india_any' }),
    a.from('relationship_dna').insert(dna(id, opts.dnaBase ?? 55)),
    a.from('partner_preferences').insert({ profile_id: id, seeking_genders: [opts.seeking], age_min: 24, age_max: 36 }),
  ]);
  return { ...user, profileId: id };
}

export async function deleteUsers(users: (TestUser | undefined)[]): Promise<void> {
  for (const u of users) if (u) await admin().auth.admin.deleteUser(u.userId);
}

export const uniqueCity = () => `Testpur ${randomUUID().slice(0, 6)}`;
