import 'server-only';
import { track } from '@/server/analytics/track';
import { DNA_DIMENSIONS, type Database } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { getSetting } from '@/server/config';
import { highestEducation, loadBundle, type ProfileBundle } from './load';

export interface CompletionReport {
  pct: number;
  /** Minimum required to activate: the essentials and who they hope to meet. Everything else is gathered after onboarding. */
  canActivate: boolean;
  /** Profile status after this refresh ('in_review' while our team screens it). */
  status?: string;
  missing: { section: string; label: string; required: boolean }[];
}

const SECTIONS: { section: string; label: string; weight: number; required: boolean; done: (b: ProfileBundle) => boolean }[] = [
  { section: 'basics', label: 'Basic details', weight: 20, required: true, done: (b) => !!(b.profile.first_name && b.profile.date_of_birth && b.profile.gender && b.profile.marital_status && b.profile.current_city) },
  { section: 'photos', label: 'At least one photo', weight: 10, required: false, done: (b) => b.photos.length > 0 },
  { section: 'about', label: 'A short introduction', weight: 8, required: false, done: (b) => (b.profile.about ?? '').trim().length >= 40 },
  { section: 'education', label: 'Education', weight: 8, required: false, done: (b) => b.education.length > 0 },
  { section: 'career', label: 'Profession', weight: 8, required: false, done: (b) => !!b.career?.profession },
  { section: 'family', label: 'Family details', weight: 8, required: false, done: (b) => !!(b.family?.family_structure || b.family?.family_values) },
  { section: 'lifestyle', label: 'Lifestyle & interests', weight: 8, required: false, done: (b) => !!b.lifestyle?.diet && (b.lifestyle.interests.length + b.lifestyle.hobbies.length) > 0 },
  { section: 'values', label: 'Values & future plans', weight: 10, required: false, done: (b) => !!(b.values?.children_preference && b.values.settle_preference) && b.profile.core_values.length > 0 },
  { section: 'dna', label: 'Relationship DNA', weight: 10, required: false, done: (b) => b.dna.length >= Math.ceil(DNA_DIMENSIONS.length * 0.7) },
  { section: 'preferences', label: 'Partner preferences', weight: 10, required: true, done: (b) => !!b.prefs && b.prefs.seeking_genders.length > 0 && b.prefs.age_min !== null },
];

export function computeCompletion(b: ProfileBundle): CompletionReport {
  let pct = 0;
  const missing: CompletionReport['missing'] = [];
  for (const s of SECTIONS) {
    if (s.done(b)) pct += s.weight;
    else missing.push({ section: s.section, label: s.label, required: s.required });
  }
  return { pct: Math.min(100, pct), canActivate: missing.every((m) => !m.required), missing };
}

/** Text indexed for full-text search. Contains only member-visible, non-sensitive fields. */
export function buildSearchText(b: ProfileBundle): string {
  const p = b.profile;
  const edu = highestEducation(b);
  return [
    p.about, p.current_city, p.current_state, p.native_place, p.mother_tongue, ...p.languages,
    ...p.core_values, ...p.personality_traits,
    edu?.qualification, edu?.specialization, edu?.institution,
    b.career?.profession, b.career?.designation, b.career?.work_city,
    ...(b.lifestyle?.hobbies ?? []), ...(b.lifestyle?.interests ?? []),
    b.values?.future_goals, b.values?.career_ambitions, b.values?.relationship_expectations,
    b.values?.settle_preference === 'abroad' ? 'abroad international relocate' : null,
    b.career?.relocation_willingness === 'open' ? 'open to relocate relocation' : null,
  ].filter(Boolean).join(' ').slice(0, 8000);
}

/**
 * Recompute completion %, search text and activation after any profile edit.
 * When the required sections are complete a draft profile is submitted for human
 * screening ('in_review') — or activated directly if screening is switched off.
 */
export async function refreshProfileDerived(profileId: string): Promise<CompletionReport | null> {
  const b = await loadBundle(profileId, { includeUnapprovedMedia: true });
  if (!b) return null;
  const report = computeCompletion(b);
  const patch: Database['public']['Tables']['profiles']['Update'] = {
    completion_pct: report.pct,
    search_text: buildSearchText(b),
  };
  if (b.profile.status === 'draft' && report.canActivate) {
    const curation = await getSetting<{ profile_screening: boolean }>('curation', { profile_screening: true });
    if (curation.profile_screening) {
      patch.status = 'in_review';
      patch.review_submitted_at = new Date().toISOString();
      patch.review_note = null;
    } else {
      patch.status = 'active';
      patch.activated_at = new Date().toISOString();
    }
  }
  await db().from('profiles').update(patch).eq('id', profileId);
  report.status = patch.status ?? b.profile.status;
  if (patch.status === 'in_review') {
    await db().from('app_users').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', b.profile.owner_user_id).is('onboarding_completed_at', null);
  }
  if (patch.status === 'active') {
    void track(b.profile.owner_user_id, 'profile_activated', { completion: report.pct, created_for: b.profile.created_for });
    await db().from('app_users').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', b.profile.owner_user_id).is('onboarding_completed_at', null);
  }
  return report;
}
