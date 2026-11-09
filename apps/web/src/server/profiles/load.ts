import 'server-only';
import type { Database } from '@2k/shared';
import { db } from '@/lib/supabase/admin';

type T = Database['public']['Tables'];
export type ProfileRow = T['profiles']['Row'];

export interface ProfileBundle {
  profile: ProfileRow;
  education: T['profile_education']['Row'][];
  career: T['profile_career']['Row'] | null;
  family: T['profile_family']['Row'] | null;
  lifestyle: T['profile_lifestyle']['Row'] | null;
  values: T['profile_values']['Row'] | null;
  dna: T['relationship_dna']['Row'][];
  prefs: T['partner_preferences']['Row'] | null;
  /** Approved photos only, ordered (primary first). */
  photos: T['profile_photos']['Row'][];
  video: T['profile_videos']['Row'] | null;
  verifiedKinds: Set<string>;
}

const PROFILE_COLUMNS =
  'id, owner_user_id, profile_code, created_for, managed_by_relation, first_name, last_name, name_visibility, date_of_birth, gender, height_cm, marital_status, has_children, mother_tongue, languages, nationality, religion, community, current_city, current_state, current_country, native_place, about, personality_traits, core_values, status, visibility, photo_visibility, sensitive_fields_visibility, messaging_policy, completion_pct, onboarding_step, is_identity_verified, is_photo_verified, search_text, embedding_model, embedding_updated_at, activated_at, last_active_at, created_at, updated_at';

/**
 * Batch-load complete profile bundles. `includeUnapprovedMedia` is for the
 * owner's own view (shows pending photos); other viewers only see approved media.
 */
export async function loadBundles(ids: string[], opts: { includeUnapprovedMedia?: boolean } = {}): Promise<Map<string, ProfileBundle>> {
  const out = new Map<string, ProfileBundle>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return out;
  const c = db();

  const photosQ = c.from('profile_photos').select('*').in('profile_id', unique).order('is_primary', { ascending: false }).order('sort_order');
  const videosQ = c.from('profile_videos').select('*').in('profile_id', unique);
  const [profiles, education, career, family, lifestyle, values, dna, prefs, photos, videos, verifs] = await Promise.all([
    c.from('profiles').select(PROFILE_COLUMNS).in('id', unique),
    c.from('profile_education').select('*').in('profile_id', unique),
    c.from('profile_career').select('*').in('profile_id', unique),
    c.from('profile_family').select('*').in('profile_id', unique),
    c.from('profile_lifestyle').select('*').in('profile_id', unique),
    c.from('profile_values').select('*').in('profile_id', unique),
    c.from('relationship_dna').select('*').in('profile_id', unique),
    c.from('partner_preferences').select('*').in('profile_id', unique),
    opts.includeUnapprovedMedia ? photosQ : photosQ.eq('moderation_status', 'approved'),
    opts.includeUnapprovedMedia ? videosQ : videosQ.eq('moderation_status', 'approved'),
    c.from('verifications').select('profile_id, kind').in('profile_id', unique).eq('status', 'approved'),
  ]);
  if (profiles.error) throw profiles.error;

  const group = <R extends { profile_id: string }>(rows: R[] | null) => {
    const m = new Map<string, R[]>();
    for (const r of rows ?? []) m.set(r.profile_id, [...(m.get(r.profile_id) ?? []), r]);
    return m;
  };
  const one = <R extends { profile_id: string }>(rows: R[] | null) => new Map((rows ?? []).map((r) => [r.profile_id, r]));

  const eduBy = group(education.data);
  const careerBy = one(career.data);
  const familyBy = one(family.data);
  const lifestyleBy = one(lifestyle.data);
  const valuesBy = one(values.data);
  const dnaBy = group(dna.data);
  const prefsBy = one(prefs.data);
  const photosBy = group(photos.data);
  const videoBy = one(videos.data);
  const verBy = group(verifs.data);

  for (const p of (profiles.data ?? []) as unknown as ProfileRow[]) {
    out.set(p.id, {
      profile: p,
      education: (eduBy.get(p.id) ?? []).sort((a, b) => Number(b.is_highest) - Number(a.is_highest)),
      career: careerBy.get(p.id) ?? null,
      family: familyBy.get(p.id) ?? null,
      lifestyle: lifestyleBy.get(p.id) ?? null,
      values: valuesBy.get(p.id) ?? null,
      dna: dnaBy.get(p.id) ?? [],
      prefs: prefsBy.get(p.id) ?? null,
      photos: photosBy.get(p.id) ?? [],
      video: videoBy.get(p.id) ?? null,
      verifiedKinds: new Set((verBy.get(p.id) ?? []).map((v) => v.kind)),
    });
  }
  return out;
}

export async function loadBundle(id: string, opts: { includeUnapprovedMedia?: boolean } = {}): Promise<ProfileBundle | null> {
  return (await loadBundles([id], opts)).get(id) ?? null;
}

/** Highest education entry (explicit flag, else highest rank). */
export function highestEducation(b: ProfileBundle) {
  return b.education.find((e) => e.is_highest) ?? b.education[0] ?? null;
}
