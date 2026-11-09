import { admin, createTestUser, type TestUser } from './helpers';

/**
 * Workstream C fixtures: real members with complete, active profiles inserted
 * through the service role. Tests track and delete only what they create.
 */
export interface Member { user: TestUser; profileId: string }

const created: string[] = [];

export async function createMember(opts: {
  label: string;
  gender: 'female' | 'male';
  seeking: 'female' | 'male';
  city?: string;
  age?: number;
  firstName?: string;
  religion?: string | null;
  sensitive?: 'members' | 'connections' | 'hidden';
  interests?: string[];
  coreValues?: string[];
  settle?: string;
  aiConsent?: boolean;
}): Promise<Member> {
  const user = await createTestUser(opts.label);
  created.push(user.userId);
  const a = admin();
  const age = opts.age ?? 30;
  const dob = new Date(Date.UTC(new Date().getUTCFullYear() - age, 0, 15)).toISOString().slice(0, 10);
  const { data: p, error } = await a
    .from('profiles')
    .insert({
      owner_user_id: user.userId,
      first_name: opts.firstName ?? opts.label,
      last_name: 'Test',
      date_of_birth: dob,
      gender: opts.gender,
      height_cm: opts.gender === 'male' ? 178 : 165,
      marital_status: 'never_married',
      current_city: opts.city ?? 'Coimbatore',
      current_country: 'IN',
      religion: opts.religion ?? null,
      sensitive_fields_visibility: opts.sensitive ?? 'connections',
      about: 'I enjoy slow mornings, long walks and good books. Looking for a kind, curious partner.',
      core_values: opts.coreValues ?? ['family', 'honesty', 'growth'],
      personality_traits: ['calm', 'curious'],
      status: 'active',
      visibility: 'members',
      activated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      completion_pct: 90,
    })
    .select('id')
    .single();
  if (error || !p) throw error ?? new Error('profile insert failed');
  const profileId = p.id;
  await Promise.all([
    a.from('partner_preferences').insert({ profile_id: profileId, seeking_genders: [opts.seeking], age_min: 22, age_max: 45 }),
    a.from('profile_lifestyle').insert({ profile_id: profileId, diet: 'vegetarian', smoking: 'never', drinking: 'never', travel: 'frequently', interests: opts.interests ?? ['Reading', 'Music', 'Hiking'], hobbies: [] }),
    a.from('profile_values').insert({ profile_id: profileId, children_preference: 'want', settle_preference: opts.settle ?? 'india_any', living_arrangement: 'independent', communication_style: 'balanced', financial_philosophy: 'balanced' }),
    a.from('profile_career').insert({ profile_id: profileId, profession: 'Engineer', income_range: '15_25l', income_visibility: 'connections', relocation_willingness: 'within_country' }),
    a.from('relationship_dna').insert(
      (['emotional_connection', 'communication', 'family_orientation', 'independence', 'career_ambition', 'lifestyle_pace', 'financial_philosophy', 'long_term_aspirations'] as const).map((d) => ({ profile_id: profileId, dimension: d, self_score: 55, importance: 3 })),
    ),
  ]);
  if (opts.aiConsent) await a.from('consent_records').insert({ user_id: user.userId, consent_type: 'ai_processing', policy_version: '2026-11-01', granted: true });
  return { user, profileId };
}

export async function connect(x: Member, y: Member): Promise<{ connectionId: string; conversationId: string }> {
  const a = admin();
  const [pa, pb] = x.profileId < y.profileId ? [x, y] : [y, x];
  const { data: c, error } = await a.from('connections').insert({ profile_a: pa.profileId, profile_b: pb.profileId }).select('id').single();
  if (error || !c) throw error ?? new Error('connection insert failed');
  const { data: conv } = await a.from('conversations').insert({ connection_id: c.id }).select('id').single();
  await a.from('conversation_participants').insert([
    { conversation_id: conv!.id, profile_id: pa.profileId, user_id: pa.user.userId },
    { conversation_id: conv!.id, profile_id: pb.profileId, user_id: pb.user.userId },
  ]);
  return { connectionId: c.id, conversationId: conv!.id };
}

export async function givePlan(m: Member | TestUser, code: 'plus' | 'premium' | 'elite'): Promise<void> {
  const userId = 'user' in m ? m.user.userId : m.userId;
  const a = admin();
  const { data: plan } = await a.from('plans').select('id').eq('code', code).single();
  await a.from('subscriptions').insert({ user_id: userId, plan_id: plan!.id, status: 'active', current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString() });
}

export async function trackUser(u: TestUser): Promise<TestUser> {
  created.push(u.userId);
  return u;
}

export async function cleanupCreated(): Promise<void> {
  const a = admin();
  for (const id of created.splice(0)) await a.auth.admin.deleteUser(id);
}

/** Read a streamed Response body fully as text. */
export async function readText(res: Response): Promise<string> {
  return await res.text();
}
