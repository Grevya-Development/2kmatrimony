import 'server-only';
import {
  ageFromDob,
  compatibilityLabel,
  displayName,
  labelOf,
  EDUCATION_LEVEL_OPTIONS,
  type CompatibilitySummary,
  type InterestStatus,
  type ProfileCard,
  type ProfileDetail,
  type RelationshipState,
} from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { signedUrls } from '@/server/media';
import { highestEducation, type ProfileBundle } from './load';

/**
 * PRIVACY PROJECTION — the only path by which one member's data reaches
 * another member. Every rule about who can see what lives here.
 */

const RECENT_MS = 7 * 24 * 3600_000;

export interface ViewerContext {
  viewerProfileId: string;
  relationships: Map<string, RelationshipState & { connectionActive: boolean; theyExpressedInterest: boolean; blocked: boolean }>;
}

/** Batch-load the viewer's relationship to each candidate. */
const CONTEXT_CHUNK = 50; // keeps PostgREST filter URLs short

export async function buildViewerContext(viewerProfileId: string, candidateIds: string[]): Promise<ViewerContext> {
  const all = [...new Set(candidateIds)].filter((id) => id !== viewerProfileId);
  if (all.length > CONTEXT_CHUNK) {
    const merged: ViewerContext = { viewerProfileId, relationships: new Map() };
    for (let i = 0; i < all.length; i += CONTEXT_CHUNK) {
      const part = await buildViewerContext(viewerProfileId, all.slice(i, i + CONTEXT_CHUNK));
      for (const [k, v] of part.relationships) merged.relationships.set(k, v);
    }
    return merged;
  }
  const ids = all;
  const relationships: ViewerContext['relationships'] = new Map();
  for (const id of ids) {
    relationships.set(id, {
      interest: null, connectionId: null, conversationId: null, shortlisted: false, passed: false,
      connectionActive: false, theyExpressedInterest: false, blocked: false,
    });
  }
  if (ids.length === 0) return { viewerProfileId, relationships };
  const c = db();
  const list = ids.join(',');
  const [sent, received, connsA, connsB, shortlist, passes, blocks] = await Promise.all([
    c.from('interests').select('id, receiver_profile_id, status, created_at').eq('sender_profile_id', viewerProfileId).in('receiver_profile_id', ids).order('created_at', { ascending: false }),
    c.from('interests').select('id, sender_profile_id, status, created_at').eq('receiver_profile_id', viewerProfileId).in('sender_profile_id', ids).order('created_at', { ascending: false }),
    c.from('connections').select('id, profile_b, status, conversations(id)').eq('profile_a', viewerProfileId).in('profile_b', ids),
    c.from('connections').select('id, profile_a, status, conversations(id)').eq('profile_b', viewerProfileId).in('profile_a', ids),
    c.from('shortlists').select('target_profile_id').eq('owner_profile_id', viewerProfileId).in('target_profile_id', ids),
    c.from('passes').select('target_profile_id').eq('profile_id', viewerProfileId).in('target_profile_id', ids),
    c.from('blocks').select('blocker_profile_id, blocked_profile_id')
      .or(`and(blocker_profile_id.eq.${viewerProfileId},blocked_profile_id.in.(${list})),and(blocked_profile_id.eq.${viewerProfileId},blocker_profile_id.in.(${list}))`),
  ]);

  for (const r of sent.data ?? []) {
    const rel = relationships.get(r.receiver_profile_id);
    if (rel && !rel.interest) rel.interest = { id: r.id, direction: 'sent', status: r.status as InterestStatus };
  }
  for (const r of received.data ?? []) {
    const rel = relationships.get(r.sender_profile_id);
    if (!rel) continue;
    if (r.status === 'pending' || r.status === 'accepted') rel.theyExpressedInterest = true;
    // Prefer showing a pending received interest (actionable) over an older sent one.
    if (!rel.interest || (r.status === 'pending' && rel.interest.status !== 'pending')) {
      rel.interest = { id: r.id, direction: 'received', status: r.status as InterestStatus };
    }
  }
  const applyConn = (otherId: string, row: { id: string; status: string; conversations: unknown }) => {
    const rel = relationships.get(otherId);
    if (!rel) return;
    rel.connectionId = row.id;
    rel.connectionActive = row.status === 'active';
    const conv = row.conversations as { id: string } | { id: string }[] | null;
    rel.conversationId = Array.isArray(conv) ? conv[0]?.id ?? null : conv?.id ?? null;
  };
  for (const r of connsA.data ?? []) applyConn(r.profile_b, r);
  for (const r of connsB.data ?? []) applyConn(r.profile_a, r);
  for (const r of shortlist.data ?? []) { const rel = relationships.get(r.target_profile_id); if (rel) rel.shortlisted = true; }
  for (const r of passes.data ?? []) { const rel = relationships.get(r.target_profile_id); if (rel) rel.passed = true; }
  for (const r of blocks.data ?? []) {
    const other = r.blocker_profile_id === viewerProfileId ? r.blocked_profile_id : r.blocker_profile_id;
    const rel = relationships.get(other);
    if (rel) rel.blocked = true;
  }
  return { viewerProfileId, relationships };
}

/** Can the viewer see this profile at all? */
export function canView(b: ProfileBundle, ctx: ViewerContext): boolean {
  const rel = ctx.relationships.get(b.profile.id);
  if (b.profile.id === ctx.viewerProfileId) return true;
  if (!rel || rel.blocked) return false;
  const connected = rel.connectionActive;
  if (b.profile.status === 'active') {
    if (b.profile.visibility === 'members') return true;
    return connected; // 'connections' or 'hidden' profiles stay visible to existing connections
  }
  return connected && b.profile.status === 'hidden';
}

function audienceAllows(audience: string, connected: boolean): boolean {
  return audience === 'members' || (audience === 'connections' && connected);
}

function photoAccess(b: ProfileBundle, connected: boolean, theyExpressedInterest: boolean): 'full' | 'blurred' | 'none' {
  switch (b.profile.photo_visibility) {
    case 'members': return 'full';
    case 'connections': return connected ? 'full' : 'none';
    case 'on_request': return connected || theyExpressedInterest ? 'full' : 'blurred';
    default: return 'none';
  }
}

function visiblePhotos(b: ProfileBundle, connected: boolean) {
  return b.photos.filter((ph) => ph.visibility === 'inherit' || (ph.visibility === 'connections' && connected));
}

export interface CardOptions {
  compatibility?: CompatibilitySummary | null;
  sharedInterests?: string[];
}

const emptyRel = (): RelationshipState => ({ interest: null, connectionId: null, conversationId: null, shortlisted: false, passed: false });

/** Build cards for many bundles at once (batched signed URLs). */
export async function toCards(bundles: ProfileBundle[], ctx: ViewerContext, extras: Map<string, CardOptions> = new Map()): Promise<ProfileCard[]> {
  const visible = bundles.filter((b) => canView(b, ctx));
  const photoPaths: string[] = [];
  const access = new Map<string, 'full' | 'blurred' | 'none'>();
  for (const b of visible) {
    const rel = ctx.relationships.get(b.profile.id);
    const connected = b.profile.id === ctx.viewerProfileId || !!rel?.connectionActive;
    const a = b.profile.id === ctx.viewerProfileId ? 'full' : photoAccess(b, connected, !!rel?.theyExpressedInterest);
    access.set(b.profile.id, a);
    const first = visiblePhotos(b, connected)[0];
    if (a === 'full' && first) photoPaths.push(first.storage_path);
  }
  const urls = await signedUrls('profile-photos', photoPaths);

  return visible.map((b) => {
    const p = b.profile;
    const rel = ctx.relationships.get(p.id);
    const connected = p.id === ctx.viewerProfileId || !!rel?.connectionActive;
    const a = access.get(p.id)!;
    const first = visiblePhotos(b, connected)[0];
    const edu = highestEducation(b);
    const extra = extras.get(p.id) ?? {};
    const { connectionActive: _c, theyExpressedInterest: _t, blocked: _b, ...relationship } = rel ?? { ...emptyRel(), connectionActive: false, theyExpressedInterest: false, blocked: false };
    return {
      id: p.id,
      profileCode: p.profile_code,
      displayName: displayName(p.first_name, p.last_name, connected && p.name_visibility !== 'initials' ? 'full' : (p.name_visibility as 'full')),
      age: ageFromDob(p.date_of_birth),
      city: p.current_city,
      country: p.current_country,
      education: edu ? edu.qualification || labelOf(EDUCATION_LEVEL_OPTIONS, edu.level as never) : null,
      profession: b.career?.designation || b.career?.profession || null,
      intro: p.about ? truncate(p.about, 180) : null,
      photoUrl: a === 'full' && first ? urls.get(first.storage_path) ?? null : null,
      photoBlurred: a === 'blurred' && !!first,
      verified: { identity: p.is_identity_verified, photo: p.is_photo_verified, phone: b.verifiedKinds.has('phone') },
      compatibility: extra.compatibility ?? null,
      sharedInterests: extra.sharedInterests ?? [],
      recentlyActive: !!p.last_active_at && Date.now() - new Date(p.last_active_at).getTime() < RECENT_MS,
      relationship,
    } satisfies ProfileCard;
  });
}

/** Full profile view, honouring section-level privacy. Returns null if not viewable. */
export async function toDetail(b: ProfileBundle, ctx: ViewerContext, extra: CardOptions = {}): Promise<ProfileDetail | null> {
  const [card] = await toCards([b], ctx, new Map([[b.profile.id, extra]]));
  if (!card) return null;
  const p = b.profile;
  const isOwn = p.id === ctx.viewerProfileId;
  const rel = ctx.relationships.get(p.id);
  const connected = isOwn || !!rel?.connectionActive;
  const sensitiveOk = isOwn || audienceAllows(p.sensitive_fields_visibility, connected);
  const incomeOk = isOwn || (sensitiveOk && audienceAllows(b.career?.income_visibility ?? 'connections', connected));
  const hidden: string[] = [];
  if (!sensitiveOk) hidden.push('religion_community', 'family_details');
  if (!incomeOk) hidden.push('income');

  const access = isOwn ? 'full' : photoAccess(b, connected, !!rel?.theyExpressedInterest);
  const photos = visiblePhotos(b, connected);
  const photoUrls = access === 'full' ? await signedUrls('profile-photos', photos.map((ph) => ph.storage_path)) : new Map<string, string>();

  let video: ProfileDetail['video'] = null;
  if (b.video && (isOwn || audienceAllows(b.video.visibility, connected))) {
    const v = await signedUrls('profile-videos', [b.video.storage_path]);
    const url = v.get(b.video.storage_path);
    if (url) video = { url, durationSeconds: b.video.duration_seconds ?? 0 };
  } else if (b.video) hidden.push('video');

  return {
    ...card,
    basics: {
      heightCm: p.height_cm,
      maritalStatus: p.marital_status as ProfileDetail['basics']['maritalStatus'],
      motherTongue: p.mother_tongue,
      languages: p.languages,
      nativePlace: p.native_place,
      religion: sensitiveOk ? p.religion : null,
      community: sensitiveOk ? p.community : null,
      about: p.about,
      personalityTraits: p.personality_traits,
      coreValues: p.core_values,
    },
    educationHistory: b.education.map((e) => ({ level: e.level as never, qualification: e.qualification, institution: e.institution, specialization: e.specialization })),
    career: b.career
      ? {
          profession: b.career.profession,
          employmentType: b.career.employment_type as never,
          company: b.career.company,
          designation: b.career.designation,
          incomeRange: incomeOk ? (b.career.income_range as never) : null,
          workCity: b.career.work_city,
          relocationWillingness: b.career.relocation_willingness as never,
        }
      : null,
    family: b.family
      ? {
          familyStructure: b.family.family_structure as never,
          familyValues: b.family.family_values as never,
          familyBackground: sensitiveOk ? b.family.family_background : null,
          fatherOccupation: sensitiveOk ? b.family.father_occupation : null,
          motherOccupation: sensitiveOk ? b.family.mother_occupation : null,
          brothers: b.family.brothers,
          sisters: b.family.sisters,
        }
      : null,
    lifestyle: b.lifestyle
      ? {
          diet: b.lifestyle.diet as never,
          smoking: b.lifestyle.smoking as never,
          drinking: b.lifestyle.drinking as never,
          fitness: b.lifestyle.fitness as never,
          travel: b.lifestyle.travel as never,
          hobbies: b.lifestyle.hobbies,
          interests: b.lifestyle.interests,
        }
      : null,
    values: b.values
      ? {
          childrenPreference: b.values.children_preference as never,
          livingArrangement: b.values.living_arrangement as never,
          settlePreference: b.values.settle_preference as never,
          relationshipExpectations: b.values.relationship_expectations,
          futureGoals: b.values.future_goals,
        }
      : null,
    photos:
      access === 'full'
        ? photos.flatMap((ph) => { const url = photoUrls.get(ph.storage_path); return url ? [{ id: ph.id, url, blurred: false }] : []; })
        : access === 'blurred'
          ? photos.map((ph) => ({ id: ph.id, url: '', blurred: true }))
          : [],
    video,
    hiddenSections: hidden,
    isOwnProfile: isOwn,
  };
}

export const compatibilitySummary = (mutual: number, confidence: number): CompatibilitySummary => ({
  mutual,
  confidence,
  label: compatibilityLabel(mutual),
});

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}
