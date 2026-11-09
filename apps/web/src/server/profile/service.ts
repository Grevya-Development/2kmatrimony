import 'server-only';
import { revokeBadge } from './badges';
import type {
  BasicsInput,
  CareerInput,
  CompletionReport,
  Database,
  DnaSaveInput,
  EducationInput,
  FamilyInput,
  LifestyleInput,
  OwnProfileResponse,
  PartnerPreferencesInput,
  PrivacyInput,
  StartProfileInput,
  ValuesInput,
} from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { getSetting } from '@/server/config';
import { errors } from '@/server/http';
import { signedUrls } from '@/server/media';
import { refreshProfileDerived, computeCompletion } from '@/server/profiles/completion';
import { loadBundle, type ProfileBundle } from '@/server/profiles/load';
import { toDetail, type ViewerContext } from '@/server/profiles/projection';
import { refreshProfileEmbedding } from '@/server/ai/embeddings';

type Tables = Database['public']['Tables'];

export const PROFILE_LIMITS_DEFAULT = { min_age: 18, max_photos: 6, video_min_seconds: 15, video_max_seconds: 60, about_max_chars: 2000 };

export function requireProfile(auth: AuthContext) {
  if (!auth.profile) throw errors.profileIncomplete('Create your profile first.');
  return auth.profile;
}

/** Throws a 422/409 with a friendly message from a Postgres error. */
function dbFail(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === '23514') throw errors.validation('One of the values is not allowed.', { db: error.message });
  if (error.code === '23505') throw errors.conflict('That already exists.', { db: error.message });
  throw new Error(error.message);
}

/** Post-edit pipeline: derived fields, embedding (best effort), audit. */
export async function afterProfileChange(auth: AuthContext, profileId: string, section: string, before: unknown, after: unknown): Promise<CompletionReport> {
  const report = (await refreshProfileDerived(profileId)) ?? { pct: 0, canActivate: false, missing: [] };
  refreshProfileEmbedding(profileId).catch(() => undefined);
  await audit(auth, { action: 'profile.update', entityType: 'profile', entityId: profileId, before, after, metadata: { section } });
  return report;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
export async function startProfile(auth: AuthContext, input: StartProfileInput) {
  const c = db();
  const policy = await getSetting<Record<string, string>>('policy_versions', { terms: '2026-11-01', privacy: '2026-11-01', ai_processing: '2026-11-01' });
  const source = auth.platform;
  const consentRows = [
    { consent_type: 'terms', granted: true, policy_version: policy.terms ?? 'unknown' },
    { consent_type: 'privacy', granted: true, policy_version: policy.privacy ?? 'unknown' },
    { consent_type: 'ai_processing', granted: input.consents.aiProcessing, policy_version: policy.ai_processing ?? 'unknown' },
  ].map((r) => ({ ...r, user_id: auth.userId, source, ip: auth.ip, user_agent: auth.userAgent }));
  const { error: consentErr } = await c.from('consent_records').insert(consentRows);
  dbFail(consentErr);

  if (auth.profile) return { profileId: auth.profile.id, created: false };

  const { data, error } = await c
    .from('profiles')
    .insert({ owner_user_id: auth.userId, created_for: input.createdFor, managed_by_relation: input.managedByRelation ?? null, onboarding_step: 'basics' })
    .select('id')
    .single();
  if (error?.code === '23505') {
    const { data: existing } = await c.from('profiles').select('id').eq('owner_user_id', auth.userId).single();
    return { profileId: existing!.id, created: false };
  }
  dbFail(error);
  await audit(auth, { action: 'profile.create', entityType: 'profile', entityId: data!.id, after: { createdFor: input.createdFor } });
  await refreshProfileDerived(data!.id);
  return { profileId: data!.id, created: true };
}

// ---------------------------------------------------------------------------
// Section savers
// ---------------------------------------------------------------------------
export async function saveBasics(auth: AuthContext, input: BasicsInput) {
  const p = requireProfile(auth);
  const patch: Tables['profiles']['Update'] = {
    first_name: input.firstName,
    last_name: input.lastName,
    name_visibility: input.nameVisibility,
    date_of_birth: input.dateOfBirth,
    gender: input.gender,
    height_cm: input.heightCm ?? null,
    marital_status: input.maritalStatus,
    has_children: input.hasChildren ?? null,
    mother_tongue: input.motherTongue,
    languages: input.languages,
    nationality: input.nationality,
    religion: input.religion,
    community: input.community,
    current_city: input.currentCity,
    current_state: input.currentState,
    current_country: input.currentCountry.toUpperCase(),
    native_place: input.nativePlace,
    about: input.about,
  };
  const { error } = await db().from('profiles').update(patch).eq('id', p.id);
  dbFail(error);
  // An ID badge vouches for these exact details; changing them withdraws it.
  const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
  const identityChanged =
    norm(p.first_name) !== norm(input.firstName) || norm(p.last_name) !== norm(input.lastName) ||
    (p.date_of_birth ?? '') !== input.dateOfBirth || (p.gender ?? '') !== input.gender;
  if (p.is_identity_verified && identityChanged) {
    await revokeBadge(auth, p.id, 'government_id', 'Your name, date of birth or gender changed after ID verification.');
  }
  if (!auth.user.full_name && auth.profile?.created_for === 'self') {
    await db().from('app_users').update({ full_name: [input.firstName, input.lastName].filter(Boolean).join(' ') }).eq('id', auth.userId);
  }
  return afterProfileChange(auth, p.id, 'basics', { first_name: p.first_name, current_city: p.current_city }, { first_name: input.firstName, current_city: input.currentCity });
}

export async function saveEducation(auth: AuthContext, input: EducationInput) {
  const p = requireProfile(auth);
  const c = db();
  const items = input.items.map((it, i) => ({ ...it, isHighest: input.items.some((x) => x.isHighest) ? it.isHighest : i === 0 }));
  if (items.filter((i) => i.isHighest).length > 1) throw errors.validation('Mark only one qualification as your highest.');
  const { error: delErr } = await c.from('profile_education').delete().eq('profile_id', p.id);
  dbFail(delErr);
  if (items.length) {
    const { error } = await c.from('profile_education').insert(
      items.map((it) => ({
        profile_id: p.id,
        level: it.level,
        qualification: it.qualification,
        institution: it.institution,
        specialization: it.specialization,
        graduation_year: it.graduationYear ?? null,
        is_highest: it.isHighest,
      })),
    );
    dbFail(error);
  }
  return afterProfileChange(auth, p.id, 'education', null, { count: items.length });
}

export async function saveCareer(auth: AuthContext, input: CareerInput) {
  const p = requireProfile(auth);
  const { error } = await db().from('profile_career').upsert({
    profile_id: p.id,
    profession: input.profession,
    employment_type: input.employmentType ?? null,
    company: input.company,
    designation: input.designation,
    income_range: input.incomeRange ?? null,
    income_visibility: input.incomeVisibility,
    work_city: input.workCity,
    work_country: input.workCountry?.toUpperCase() ?? null,
    relocation_willingness: input.relocationWillingness ?? null,
  });
  dbFail(error);
  return afterProfileChange(auth, p.id, 'career', null, { profession: input.profession });
}

export async function saveFamily(auth: AuthContext, input: FamilyInput) {
  const p = requireProfile(auth);
  const { error } = await db().from('profile_family').upsert({
    profile_id: p.id,
    family_structure: input.familyStructure ?? null,
    family_values: input.familyValues ?? null,
    family_background: input.familyBackground,
    father_occupation: input.fatherOccupation,
    mother_occupation: input.motherOccupation,
    brothers: input.brothers ?? null,
    sisters: input.sisters ?? null,
    siblings_details: input.siblingsDetails,
    family_native_place: input.familyNativePlace,
    family_location: input.familyLocation,
  });
  dbFail(error);
  return afterProfileChange(auth, p.id, 'family', null, { familyStructure: input.familyStructure });
}

export async function saveLifestyle(auth: AuthContext, input: LifestyleInput) {
  const p = requireProfile(auth);
  const { error } = await db().from('profile_lifestyle').upsert({
    profile_id: p.id,
    diet: input.diet ?? null,
    smoking: input.smoking ?? null,
    drinking: input.drinking ?? null,
    fitness: input.fitness ?? null,
    travel: input.travel ?? null,
    hobbies: input.hobbies,
    interests: input.interests,
  });
  dbFail(error);
  return afterProfileChange(auth, p.id, 'lifestyle', null, { interests: input.interests.length });
}

export async function saveValues(auth: AuthContext, input: ValuesInput) {
  const p = requireProfile(auth);
  const c = db();
  const { error } = await c.from('profile_values').upsert({
    profile_id: p.id,
    emotional_expectations: input.emotionalExpectations,
    communication_style: input.communicationStyle ?? null,
    conflict_style: input.conflictStyle ?? null,
    family_responsibilities: input.familyResponsibilities,
    career_ambitions: input.careerAmbitions,
    financial_philosophy: input.financialPhilosophy ?? null,
    relationship_expectations: input.relationshipExpectations,
    future_goals: input.futureGoals,
    independence_level: input.independenceLevel ?? null,
    children_preference: input.childrenPreference ?? null,
    living_arrangement: input.livingArrangement ?? null,
    settle_preference: input.settlePreference ?? null,
    household_split: input.householdSplit ?? null,
  });
  dbFail(error);
  if (input.coreValues || input.personalityTraits) {
    const patch: Tables['profiles']['Update'] = {};
    if (input.coreValues) patch.core_values = input.coreValues;
    if (input.personalityTraits) patch.personality_traits = input.personalityTraits;
    const { error: e2 } = await c.from('profiles').update(patch).eq('id', p.id);
    dbFail(e2);
  }
  return afterProfileChange(auth, p.id, 'values', null, { childrenPreference: input.childrenPreference });
}

export async function saveDna(auth: AuthContext, input: DnaSaveInput) {
  const p = requireProfile(auth);
  const c = db();
  const { data: existing } = await c.from('relationship_dna').select('dimension, self_score, partner_target, importance, source').eq('profile_id', p.id);
  const prev = new Map((existing ?? []).map((r) => [r.dimension, r]));
  const now = new Date().toISOString();
  const rows = input.entries.map((e) => {
    const old = prev.get(e.dimension);
    let source: 'explicit' | 'ai_suggested' | 'user_corrected' = 'explicit';
    if (e.origin === 'ai_accepted') source = 'ai_suggested';
    else if (e.origin === 'ai_corrected') source = 'user_corrected';
    else if (old && old.source !== 'explicit') {
      const changed = old.self_score !== e.selfScore || old.partner_target !== e.partnerTarget || old.importance !== e.importance;
      source = changed ? 'user_corrected' : (old.source as typeof source);
    }
    return {
      profile_id: p.id,
      dimension: e.dimension,
      self_score: e.selfScore,
      partner_target: e.partnerTarget,
      importance: e.importance,
      flexible: e.flexible,
      statement: e.statement,
      source,
      confirmed_at: now,
    };
  });
  const { error } = await c.from('relationship_dna').upsert(rows, { onConflict: 'profile_id,dimension' });
  dbFail(error);
  return afterProfileChange(auth, p.id, 'dna', null, { dimensions: rows.map((r) => `${r.dimension}:${r.source}`) });
}

export async function savePreferences(auth: AuthContext, input: PartnerPreferencesInput) {
  const p = requireProfile(auth);
  const { error } = await db().from('partner_preferences').upsert({
    profile_id: p.id,
    seeking_genders: input.seekingGenders,
    age_min: input.ageMin,
    age_max: input.ageMax,
    height_min_cm: input.heightMinCm ?? null,
    height_max_cm: input.heightMaxCm ?? null,
    marital_statuses: input.maritalStatuses,
    education_levels: input.educationLevels,
    professions: input.professions,
    min_income_range: input.minIncomeRange ?? null,
    countries: input.countries.map((x) => x.toUpperCase()),
    cities: input.cities,
    open_to_relocate_partner: input.openToRelocatePartner ?? null,
    diets: input.diets,
    smoking_ok: input.smokingOk,
    drinking_ok: input.drinkingOk,
    family_values: input.familyValues,
    children_preferences: input.childrenPreferences,
    living_arrangements: input.livingArrangements,
    personality_traits: input.personalityTraits,
    core_values: input.coreValues,
    mother_tongues: input.motherTongues,
    religions: input.religions,
    non_negotiables: input.nonNegotiables,
    free_text: input.freeText,
  });
  dbFail(error);
  return afterProfileChange(auth, p.id, 'preferences', null, { nonNegotiables: input.nonNegotiables });
}

export async function savePrivacy(auth: AuthContext, input: PrivacyInput) {
  const p = requireProfile(auth);
  const before = { visibility: p.visibility, photo_visibility: p.photo_visibility, sensitive_fields_visibility: p.sensitive_fields_visibility, name_visibility: p.name_visibility, messaging_policy: p.messaging_policy };
  const after = { visibility: input.visibility, photo_visibility: input.photoVisibility, sensitive_fields_visibility: input.sensitiveFieldsVisibility, name_visibility: input.nameVisibility, messaging_policy: input.messagingPolicy };
  const { error } = await db().from('profiles').update(after).eq('id', p.id);
  dbFail(error);
  await audit(auth, { action: 'profile.privacy.update', entityType: 'profile', entityId: p.id, before, after });
  return (await refreshProfileDerived(p.id))!;
}

export async function setOnboardingStep(auth: AuthContext, step: string) {
  const p = requireProfile(auth);
  await db().from('profiles').update({ onboarding_step: step }).eq('id', p.id);
  return { onboardingStep: step };
}

// ---------------------------------------------------------------------------
// Read own profile
// ---------------------------------------------------------------------------
const PREVIEW_VIEWER = '00000000-0000-0000-0000-000000000000';

/** Viewer context of a signed-in member with no relationship to the owner. */
export function strangerContext(profileId: string): ViewerContext {
  return {
    viewerProfileId: PREVIEW_VIEWER,
    relationships: new Map([[profileId, { interest: null, connectionId: null, conversationId: null, shortlisted: false, passed: false, connectionActive: false, theyExpressedInterest: false, blocked: false }]]),
  };
}

export async function getOwnProfile(auth: AuthContext, opts: { preview?: boolean } = {}): Promise<OwnProfileResponse> {
  const p = requireProfile(auth);
  const bundle = await loadBundle(p.id, { includeUnapprovedMedia: true });
  if (!bundle) throw errors.notFound('Profile not found.');
  const limits = await getSetting('limits', PROFILE_LIMITS_DEFAULT);

  let detail;
  if (opts.preview) {
    // Strangers only see approved media and an active profile; show what they would see.
    const approved = await loadBundle(p.id);
    const asActive: ProfileBundle = { ...approved!, profile: { ...approved!.profile, status: 'active' } };
    detail = await toDetail(asActive, strangerContext(p.id));
  } else {
    detail = await toDetail(bundle, { viewerProfileId: p.id, relationships: new Map() });
  }

  const photoUrls = await signedUrls('profile-photos', bundle.photos.map((ph) => ph.storage_path));
  const videoUrl = bundle.video ? (await signedUrls('profile-videos', [bundle.video.storage_path])).get(bundle.video.storage_path) ?? null : null;
  return {
    profileId: p.id,
    profileCode: bundle.profile.profile_code,
    status: bundle.profile.status as OwnProfileResponse['status'],
    createdFor: bundle.profile.created_for as OwnProfileResponse['createdFor'],
    onboardingStep: bundle.profile.onboarding_step,
    completion: { ...computeCompletion(bundle), status: bundle.profile.status },
    detail,
    form: toForm(bundle),
    photos: bundle.photos.map((ph) => ({
      id: ph.id,
      url: photoUrls.get(ph.storage_path) ?? null,
      isPrimary: ph.is_primary,
      sortOrder: ph.sort_order,
      visibility: ph.visibility as 'inherit',
      moderationStatus: ph.moderation_status as 'pending',
      moderationReason: ph.moderation_reason,
    })),
    video: bundle.video
      ? { url: videoUrl, durationSeconds: bundle.video.duration_seconds ?? 0, visibility: bundle.video.visibility as 'members', moderationStatus: bundle.video.moderation_status as 'pending' }
      : null,
    limits: { maxPhotos: limits.max_photos, videoMinSeconds: limits.video_min_seconds, videoMaxSeconds: limits.video_max_seconds },
  };
}

type Form = OwnProfileResponse['form'];

export function toForm(b: ProfileBundle): Form {
  const p = b.profile;
  const n = <T>(v: T | null | undefined) => (v === null ? undefined : v) as T | undefined;
  return {
    basics: {
      firstName: n(p.first_name), lastName: p.last_name, nameVisibility: p.name_visibility as 'first_name',
      dateOfBirth: n(p.date_of_birth), gender: n(p.gender) as never, heightCm: p.height_cm, maritalStatus: n(p.marital_status) as never,
      hasChildren: p.has_children, motherTongue: p.mother_tongue, languages: p.languages, nationality: p.nationality,
      religion: p.religion, community: p.community, currentCity: n(p.current_city), currentState: p.current_state,
      currentCountry: p.current_country ?? 'IN', nativePlace: p.native_place, about: p.about,
    },
    education: b.education.map((e) => ({ id: e.id, level: e.level as never, qualification: e.qualification, institution: e.institution, specialization: e.specialization, graduationYear: e.graduation_year, isHighest: e.is_highest })),
    career: b.career
      ? { profession: b.career.profession, employmentType: b.career.employment_type as never, company: b.career.company, designation: b.career.designation, incomeRange: b.career.income_range as never, incomeVisibility: b.career.income_visibility as never, workCity: b.career.work_city, workCountry: b.career.work_country, relocationWillingness: b.career.relocation_willingness as never }
      : {},
    family: b.family
      ? { familyStructure: b.family.family_structure as never, familyValues: b.family.family_values as never, familyBackground: b.family.family_background, fatherOccupation: b.family.father_occupation, motherOccupation: b.family.mother_occupation, brothers: b.family.brothers, sisters: b.family.sisters, siblingsDetails: b.family.siblings_details, familyNativePlace: b.family.family_native_place, familyLocation: b.family.family_location }
      : {},
    lifestyle: b.lifestyle
      ? { diet: b.lifestyle.diet as never, smoking: b.lifestyle.smoking as never, drinking: b.lifestyle.drinking as never, fitness: b.lifestyle.fitness as never, travel: b.lifestyle.travel as never, hobbies: b.lifestyle.hobbies, interests: b.lifestyle.interests }
      : { hobbies: [], interests: [] },
    values: {
      ...(b.values
        ? { emotionalExpectations: b.values.emotional_expectations, communicationStyle: b.values.communication_style as never, conflictStyle: b.values.conflict_style as never, familyResponsibilities: b.values.family_responsibilities, careerAmbitions: b.values.career_ambitions, financialPhilosophy: b.values.financial_philosophy as never, relationshipExpectations: b.values.relationship_expectations, futureGoals: b.values.future_goals, independenceLevel: b.values.independence_level as never, childrenPreference: b.values.children_preference as never, livingArrangement: b.values.living_arrangement as never, settlePreference: b.values.settle_preference as never, householdSplit: b.values.household_split as never }
        : {}),
      coreValues: p.core_values as never,
      personalityTraits: p.personality_traits as never,
    },
    dna: b.dna.map((d) => ({ dimension: d.dimension as never, selfScore: d.self_score, partnerTarget: d.partner_target, importance: d.importance, flexible: d.flexible, statement: d.statement, source: d.source as 'explicit' })),
    preferences: b.prefs
      ? {
          seekingGenders: b.prefs.seeking_genders as never, ageMin: b.prefs.age_min ?? undefined, ageMax: b.prefs.age_max ?? undefined,
          heightMinCm: b.prefs.height_min_cm, heightMaxCm: b.prefs.height_max_cm, maritalStatuses: b.prefs.marital_statuses as never,
          educationLevels: b.prefs.education_levels as never, professions: b.prefs.professions, minIncomeRange: b.prefs.min_income_range as never,
          countries: b.prefs.countries, cities: b.prefs.cities, openToRelocatePartner: b.prefs.open_to_relocate_partner,
          diets: b.prefs.diets as never, smokingOk: b.prefs.smoking_ok as never, drinkingOk: b.prefs.drinking_ok as never,
          familyValues: b.prefs.family_values as never, childrenPreferences: b.prefs.children_preferences as never,
          livingArrangements: b.prefs.living_arrangements as never, personalityTraits: b.prefs.personality_traits as never,
          coreValues: b.prefs.core_values as never, motherTongues: b.prefs.mother_tongues, religions: b.prefs.religions,
          nonNegotiables: b.prefs.non_negotiables as never, freeText: b.prefs.free_text,
        }
      : null,
    privacy: {
      visibility: p.visibility as 'members',
      photoVisibility: p.photo_visibility as 'members',
      sensitiveFieldsVisibility: p.sensitive_fields_visibility as 'members',
      nameVisibility: p.name_visibility as 'first_name',
      messagingPolicy: p.messaging_policy as 'connections',
    },
  };
}
