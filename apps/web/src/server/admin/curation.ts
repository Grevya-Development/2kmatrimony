import 'server-only';
import { z } from 'zod';
import { ageFromDob, displayName } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { publicEnv } from '@/lib/env';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { getSetting } from '@/server/config';
import { errors } from '@/server/http';
import { signedUrls } from '@/server/media';
import { notify } from '@/server/notify';
import { track } from '@/server/analytics/track';
import { highestEducation, loadBundle, loadBundles, type ProfileBundle } from '@/server/profiles/load';
import { scoreCandidates } from '@/server/matching/service';

/**
 * CURATION — the human side of 2K Marriage.
 *  - Screening: every completed profile is reviewed by a team member before it goes live.
 *  - Introductions: matchmakers hand-pick matches for a member, with a personal note.
 */

const today = () => new Date().toISOString().slice(0, 10);
const appLink = (path: string) => `${publicEnv.appUrl.replace(/\/$/, '')}${path}`;

// ---------------------------------------------------------------------------
// Screening
// ---------------------------------------------------------------------------
export interface ScreeningItem {
  profileId: string;
  profileCode: string;
  name: string;
  createdFor: string;
  gender: string | null;
  age: number | null;
  city: string | null;
  completionPct: number;
  submittedAt: string | null;
  waitingHours: number;
  overdue: boolean;
  pendingPhotos: number;
  photoUrl: string | null;
}

export async function listScreeningQueue(): Promise<{ items: ScreeningItem[]; slaHours: number }> {
  const { screening_sla_hours: slaHours } = await getSetting('curation', { profile_screening: true, screening_sla_hours: 24 });
  const { data, error } = await db()
    .from('profiles')
    .select('id, profile_code, first_name, last_name, created_for, gender, date_of_birth, current_city, completion_pct, review_submitted_at, updated_at')
    .eq('status', 'in_review')
    .order('review_submitted_at', { ascending: true, nullsFirst: true })
    .limit(200);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const { data: photos } = ids.length
    ? await db().from('profile_photos').select('profile_id, storage_path, moderation_status, is_primary, sort_order').in('profile_id', ids).order('is_primary', { ascending: false }).order('sort_order')
    : { data: [] };
  const firstPhoto = new Map<string, string>();
  const pending = new Map<string, number>();
  for (const ph of photos ?? []) {
    if (!firstPhoto.has(ph.profile_id)) firstPhoto.set(ph.profile_id, ph.storage_path);
    if (ph.moderation_status === 'pending') pending.set(ph.profile_id, (pending.get(ph.profile_id) ?? 0) + 1);
  }
  const urls = await signedUrls('profile-photos', [...firstPhoto.values()]);
  const now = Date.now();
  return {
    slaHours,
    items: rows.map((r) => {
      const since = r.review_submitted_at ?? r.updated_at;
      const waitingHours = Math.max(0, Math.round((now - new Date(since).getTime()) / 3600_000));
      return {
        profileId: r.id,
        profileCode: r.profile_code,
        name: displayName(r.first_name, r.last_name, 'full'),
        createdFor: r.created_for,
        gender: r.gender,
        age: ageFromDob(r.date_of_birth),
        city: r.current_city,
        completionPct: r.completion_pct,
        submittedAt: r.review_submitted_at,
        waitingHours,
        overdue: waitingHours >= slaHours,
        pendingPhotos: pending.get(r.id) ?? 0,
        photoUrl: firstPhoto.has(r.id) ? urls.get(firstPhoto.get(r.id)!) ?? null : null,
      };
    }),
  };
}

export const screeningDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), approvePhotos: z.boolean().default(true) }),
  z.object({ action: z.literal('request_changes'), note: z.string().trim().min(10, 'Tell the member what to change (at least a sentence).').max(1000) }),
]);

export async function decideScreening(auth: AuthContext, profileId: string, input: z.infer<typeof screeningDecisionSchema>): Promise<{ status: string }> {
  const c = db();
  const { data: p } = await c.from('profiles').select('id, owner_user_id, status, created_for, completion_pct').eq('id', profileId).maybeSingle();
  if (!p) throw errors.notFound('Profile not found.');
  if (p.status !== 'in_review') throw errors.conflict('This profile is not waiting for review.');
  const now = new Date().toISOString();

  if (input.action === 'approve') {
    const { error } = await c.from('profiles')
      .update({ status: 'active', activated_at: now, reviewed_at: now, reviewed_by: auth.userId, review_note: null })
      .eq('id', profileId).eq('status', 'in_review');
    if (error) throw error;
    let photosApproved = 0;
    if (input.approvePhotos) {
      const { count } = await c.from('profile_photos')
        .update({ moderation_status: 'approved', moderated_by: auth.userId, moderated_at: now }, { count: 'exact' })
        .eq('profile_id', profileId).eq('moderation_status', 'pending');
      photosApproved = count ?? 0;
    }
    await audit(auth, { action: 'admin.profile.screening.approve', entityType: 'profile', entityId: profileId, before: { status: 'in_review' }, after: { status: 'active', photosApproved } });
    await notify({ userId: p.owner_user_id, category: 'verification', templateKey: 'profile_approved', vars: { link: appLink('/app') }, data: { href: '/app' } });
    track(p.owner_user_id, 'profile_activated', { completion: p.completion_pct, created_for: p.created_for, screened: true });
    return { status: 'active' };
  }

  const { error } = await c.from('profiles')
    .update({ status: 'draft', reviewed_at: now, reviewed_by: auth.userId, review_note: input.note })
    .eq('id', profileId).eq('status', 'in_review');
  if (error) throw error;
  await audit(auth, { action: 'admin.profile.screening.request_changes', entityType: 'profile', entityId: profileId, before: { status: 'in_review' }, after: { status: 'draft', note: input.note } });
  await notify({ userId: p.owner_user_id, category: 'verification', templateKey: 'profile_changes_requested', vars: { note: input.note, link: appLink('/app/profile') }, data: { href: '/app/profile' } });
  return { status: 'draft' };
}

// ---------------------------------------------------------------------------
// Hand-picked introductions
// ---------------------------------------------------------------------------
function summary(b: ProfileBundle, photoUrl: string | null) {
  const p = b.profile;
  const edu = highestEducation(b);
  return {
    profileId: p.id,
    profileCode: p.profile_code,
    name: displayName(p.first_name, p.last_name, 'full'),
    age: ageFromDob(p.date_of_birth),
    gender: p.gender,
    city: p.current_city,
    motherTongue: p.mother_tongue,
    education: edu?.qualification ?? null,
    profession: b.career?.designation || b.career?.profession || null,
    photoUrl,
  };
}

export async function searchMembers(q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const c = db();
  const query = /^tk\d+$/i.test(term)
    ? c.from('profiles').select('id').eq('profile_code', term.toUpperCase())
    : c.from('profiles').select('id').or(`first_name.ilike.%${term.replace(/[%_,()]/g, '')}%,last_name.ilike.%${term.replace(/[%_,()]/g, '')}%`);
  const { data } = await query.eq('status', 'active').limit(20);
  const bundles = await loadBundles((data ?? []).map((r) => r.id));
  const firsts = [...bundles.values()].map((b) => b.photos[0]?.storage_path).filter(Boolean) as string[];
  const urls = await signedUrls('profile-photos', firsts);
  return [...bundles.values()].map((b) => summary(b, b.photos[0] ? urls.get(b.photos[0].storage_path) ?? null : null));
}

export async function introductionWorkspace(memberId: string) {
  const member = await loadBundle(memberId);
  if (!member) throw errors.notFound('Member not found.');
  if (member.profile.status !== 'active') throw errors.conflict('Introductions can only be made for live profiles.');
  const prefs = member.prefs;
  const c = db();

  const [{ data: ids }, { data: recent }] = await Promise.all([
    c.rpc('recommendation_candidates', {
      p_viewer: memberId,
      p_seeking: prefs?.seeking_genders ?? [],
      p_age_min: prefs?.age_min != null ? Math.max(18, prefs.age_min - 2) : (null as unknown as number),
      p_age_max: prefs?.age_max != null ? prefs.age_max + 2 : (null as unknown as number),
      p_limit: 300,
    }),
    c.from('recommendations').select('id, candidate_profile_id, reason, status, created_at, created_by').eq('profile_id', memberId).eq('source', 'matchmaker').order('created_at', { ascending: false }).limit(30),
  ]);

  const introduced = new Set((recent ?? []).map((r) => r.candidate_profile_id));
  const candidateIds = (ids ?? []).map((r) => r.profile_id).filter((id) => !introduced.has(id));
  const bundles = await loadBundles([...candidateIds, ...introduced]);
  const scored = await scoreCandidates(member, candidateIds.map((id) => bundles.get(id)).filter(Boolean) as ProfileBundle[]);
  const ranked = [...scored.values()].filter((p) => p.eligible).sort((a, b) => b.mutual - a.mutual).slice(0, 30);

  const photoPaths = [...ranked.map((p) => bundles.get(p.bId)?.photos[0]?.storage_path), ...[...introduced].map((id) => bundles.get(id)?.photos[0]?.storage_path), member.photos[0]?.storage_path].filter(Boolean) as string[];
  const urls = await signedUrls('profile-photos', photoPaths);
  const photo = (b?: ProfileBundle) => (b?.photos[0] ? urls.get(b.photos[0].storage_path) ?? null : null);

  return {
    member: {
      ...summary(member, photo(member)),
      about: member.profile.about,
      preferences: prefs
        ? {
            seeking: prefs.seeking_genders,
            age: prefs.age_min || prefs.age_max ? `${prefs.age_min ?? '—'}–${prefs.age_max ?? '—'}` : null,
            cities: prefs.cities,
            educationLevels: prefs.education_levels,
            diets: prefs.diets,
            motherTongues: prefs.mother_tongues,
            nonNegotiables: prefs.non_negotiables,
            freeText: prefs.free_text,
          }
        : null,
    },
    candidates: ranked.map((p) => ({ ...summary(bundles.get(p.bId)!, photo(bundles.get(p.bId))), mutual: p.mutual, forMember: p.aToB.score, forCandidate: p.bToA.score, sharedInterests: p.sharedInterests.slice(0, 4) })),
    recent: (recent ?? []).flatMap((r) => {
      const b = bundles.get(r.candidate_profile_id);
      return b ? [{ id: r.id, note: r.reason, status: r.status, createdAt: r.created_at, candidate: summary(b, photo(b)) }] : [];
    }),
  };
}

export const introductionSchema = z.object({
  memberProfileId: z.uuid(),
  candidateProfileId: z.uuid(),
  note: z.string().trim().min(20, 'Write a short personal note (at least a sentence) on why they should meet.').max(600),
});

export async function createIntroduction(auth: AuthContext, input: z.infer<typeof introductionSchema>) {
  if (input.memberProfileId === input.candidateProfileId) throw errors.validation('Choose someone other than the member.');
  const c = db();
  const bundles = await loadBundles([input.memberProfileId, input.candidateProfileId]);
  const member = bundles.get(input.memberProfileId);
  const candidate = bundles.get(input.candidateProfileId);
  if (!member || !candidate) throw errors.notFound('Profile not found.');
  if (member.profile.status !== 'active' || candidate.profile.status !== 'active') throw errors.conflict('Both profiles must be live.');
  const { data: blocks } = await c.from('blocks').select('blocker_profile_id')
    .or(`and(blocker_profile_id.eq.${input.memberProfileId},blocked_profile_id.eq.${input.candidateProfileId}),and(blocker_profile_id.eq.${input.candidateProfileId},blocked_profile_id.eq.${input.memberProfileId})`).limit(1);
  if (blocks?.length) throw errors.conflict('These members cannot be introduced.');
  const pair = (await scoreCandidates(member, [candidate])).get(input.candidateProfileId);
  if (!pair?.eligible) throw errors.conflict('This candidate falls outside one of their non-negotiables, so we won’t introduce them.');

  const { data: row, error } = await c.from('recommendations').upsert({
    profile_id: input.memberProfileId,
    candidate_profile_id: input.candidateProfileId,
    score: pair.mutual,
    source: 'matchmaker',
    reason: input.note,
    status: 'new',
    batch_date: today(),
    created_by: auth.userId,
  }, { onConflict: 'profile_id,candidate_profile_id,batch_date' }).select('id').single();
  if (error) throw error;

  await audit(auth, { action: 'admin.introduction.create', entityType: 'recommendation', entityId: row.id, after: { member: input.memberProfileId, candidate: input.candidateProfileId, mutual: pair.mutual } });
  await notify({ userId: member.profile.owner_user_id, category: 'recommendations', templateKey: 'introduction_received', vars: { link: appLink('/app') }, data: { href: '/app' } });
  return { id: row.id, mutual: pair.mutual };
}
