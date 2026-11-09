import 'server-only';
import { z } from 'zod';
import { VERIFICATION_KIND_LABELS, type VerificationKind } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { Database } from '@2k/shared';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { errors } from '@/server/http';
import { signedUrls, type Bucket } from '@/server/media';
import { notify } from '@/server/notify';
import { loadBundle } from '@/server/profiles/load';
import { likeSafe, paged, qp, reasonSchema, type Page } from './common';
import { reactivateUser, suspendUser } from './users';

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export async function listProfiles(req: Request, p: Page) {
  const q = qp(req, 'q');
  const status = qp(req, 'status');
  let query = db()
    .from('profiles')
    .select('id, owner_user_id, profile_code, first_name, last_name, gender, current_city, status, visibility, completion_pct, is_identity_verified, is_photo_verified, created_at, last_active_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(p.offset, p.offset + p.limit - 1);
  if (q) {
    const s = likeSafe(q);
    query = /^tk\d+$/i.test(q) ? query.eq('profile_code', q.toUpperCase()) : query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,current_city.ilike.%${s}%`);
  }
  if (status) query = query.eq('status', status);
  const { data, count, error } = await query;
  if (error) throw error;
  return paged(data ?? [], count, p);
}

/** Full admin view of a profile, including fields hidden from members. */
export async function getAdminProfile(profileId: string) {
  const b = await loadBundle(profileId, { includeUnapprovedMedia: true });
  if (!b) throw errors.notFound('Profile not found.');
  const photoUrls = await signedUrls('profile-photos', b.photos.map((ph) => ph.storage_path));
  const videoUrl = b.video ? (await signedUrls('profile-videos', [b.video.storage_path])).get(b.video.storage_path) ?? null : null;
  const { search_text: _s, ...profile } = b.profile as typeof b.profile & { search_text?: string };
  return {
    profile,
    education: b.education,
    career: b.career,
    family: b.family,
    lifestyle: b.lifestyle,
    values: b.values,
    dna: b.dna,
    preferences: b.prefs,
    photos: b.photos.map((ph) => ({ id: ph.id, url: photoUrls.get(ph.storage_path) ?? null, isPrimary: ph.is_primary, visibility: ph.visibility, moderationStatus: ph.moderation_status, moderationReason: ph.moderation_reason, createdAt: ph.created_at })),
    video: b.video ? { id: b.video.id, url: videoUrl, durationSeconds: b.video.duration_seconds, moderationStatus: b.video.moderation_status, visibility: b.video.visibility } : null,
    verifiedKinds: [...b.verifiedKinds],
  };
}

export const profileVisibilitySchema = z.object({ action: z.enum(['hide', 'unhide']), reason: reasonSchema });

export async function setProfileHidden(auth: AuthContext, profileId: string, input: z.infer<typeof profileVisibilitySchema>) {
  const c = db();
  const { data: before } = await c.from('profiles').select('status, owner_user_id, activated_at').eq('id', profileId).maybeSingle();
  if (!before) throw errors.notFound('Profile not found.');
  if (input.action === 'hide') {
    if (before.status === 'deleted') throw errors.conflict('Profile is deleted.');
    await c.from('profiles').update({ status: 'hidden' }).eq('id', profileId);
  } else {
    if (before.status !== 'hidden') throw errors.conflict('Profile is not hidden.');
    await c.from('profiles').update({ status: before.activated_at ? 'active' : 'draft' }).eq('id', profileId);
  }
  await c.from('moderation_actions').insert({ admin_user_id: auth.userId, target_user_id: before.owner_user_id, target_profile_id: profileId, action: input.action === 'hide' ? 'hide_profile' : 'reinstate', reason: input.reason });
  await audit(auth, { action: `admin.profile.${input.action}`, entityType: 'profile', entityId: profileId, before: { status: before.status }, after: { action: input.action }, metadata: { reason: input.reason } });
}

// ---------------------------------------------------------------------------
// Media moderation
// ---------------------------------------------------------------------------
export async function mediaQueue(req: Request, p: Page) {
  const kind = qp(req, 'kind') === 'video' ? 'video' : 'photo';
  const status = qp(req, 'status') ?? 'pending';
  const table = kind === 'video' ? 'profile_videos' : 'profile_photos';
  const { data, count, error } = await db()
    .from(table)
    .select('id, profile_id, storage_path, moderation_status, moderation_reason, created_at, profiles(profile_code, first_name)', { count: 'exact' })
    .eq('moderation_status', status)
    .order('created_at', { ascending: true })
    .range(p.offset, p.offset + p.limit - 1);
  if (error) throw error;
  const urls = await signedUrls(kind === 'video' ? 'profile-videos' : 'profile-photos', (data ?? []).map((r) => r.storage_path));
  return paged(
    (data ?? []).map((r) => {
      const prof = r.profiles as unknown as { profile_code: string; first_name: string | null } | null;
      return { id: r.id, kind, profileId: r.profile_id, profileCode: prof?.profile_code ?? null, name: prof?.first_name ?? null, url: urls.get(r.storage_path) ?? null, status: r.moderation_status, reason: r.moderation_reason, createdAt: r.created_at };
    }),
    count,
    p,
  );
}

export const mediaDecisionSchema = z.object({
  kind: z.enum(['photo', 'video']),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(500).optional(),
}).refine((v) => v.decision === 'approved' || (v.reason && v.reason.length >= 5), { message: 'A reason is required when rejecting.', path: ['reason'] });

export async function decideMedia(auth: AuthContext, mediaId: string, input: z.infer<typeof mediaDecisionSchema>) {
  const c = db();
  const table = input.kind === 'video' ? 'profile_videos' : 'profile_photos';
  const { data: before } = await c.from(table).select('id, profile_id, moderation_status, profiles(owner_user_id)').eq('id', mediaId).maybeSingle();
  if (!before) throw errors.notFound('Media not found.');
  await c.from(table).update({ moderation_status: input.decision, moderation_reason: input.reason ?? null, moderated_by: auth.userId, moderated_at: new Date().toISOString() }).eq('id', mediaId);
  const ownerId = (before.profiles as unknown as { owner_user_id: string } | null)?.owner_user_id;
  if (input.decision === 'rejected' && ownerId) {
    await notify({ userId: ownerId, category: 'verification', templateKey: 'moderation_media_removed', vars: { kind: input.kind, reason: input.reason }, data: { href: '/app/profile' } });
  }
  await audit(auth, { action: `admin.media.${input.decision}`, entityType: table, entityId: mediaId, before: { moderation_status: before.moderation_status }, after: { moderation_status: input.decision, reason: input.reason ?? null } });
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------
export async function verificationQueue(req: Request, p: Page) {
  const status = qp(req, 'status') ?? 'pending';
  const kind = qp(req, 'kind');
  let query = db()
    .from('verifications')
    .select('id, profile_id, kind, status, provider, document_type, attempt, created_at, reviewed_at, profiles(profile_code, first_name, last_name)', { count: 'exact' })
    .order('created_at', { ascending: true })
    .range(p.offset, p.offset + p.limit - 1);
  query = status === 'open' ? query.in('status', ['pending', 'in_review']) : query.eq('status', status);
  if (kind) query = query.eq('kind', kind);
  const { data, count, error } = await query;
  if (error) throw error;
  return paged(
    (data ?? []).map((v) => {
      const prof = v.profiles as unknown as { profile_code: string; first_name: string | null; last_name: string | null } | null;
      return { ...v, profiles: undefined, profileCode: prof?.profile_code ?? null, name: [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || null, ageHours: Math.round((Date.now() - new Date(v.created_at).getTime()) / 3600_000) };
    }),
    count,
    p,
  );
}

/** Verification detail. Documents (signed URLs) only for sensitive_data.read — every view audited. */
export async function getVerification(auth: AuthContext, id: string) {
  const c = db();
  const { data: v } = await c.from('verifications').select('*, profiles(id, profile_code, first_name, last_name, date_of_birth, gender, current_city, is_identity_verified, is_photo_verified)').eq('id', id).maybeSingle();
  if (!v) throw errors.notFound('Verification not found.');
  const { data: events } = await c.from('verification_events').select('id, from_status, to_status, note, actor_user_id, created_at').eq('verification_id', id).order('created_at');
  const canSeeDocs = !!auth.admin?.can('sensitive_data.read');
  let documents: { path: string; url: string | null }[] = [];
  if (canSeeDocs && v.document_paths.length) {
    const urls = await signedUrls('verification-docs', v.document_paths, 600);
    documents = v.document_paths.map((path) => ({ path, url: urls.get(path) ?? null }));
    await audit(auth, { action: 'admin.sensitive.view', entityType: 'verification', entityId: id, metadata: { documents: v.document_paths.length } });
  }
  // Photo verification: show the member's primary photo for comparison.
  let primaryPhotoUrl: string | null = null;
  if (v.kind === 'photo') {
    const { data: ph } = await c.from('profile_photos').select('storage_path').eq('profile_id', v.profile_id).eq('is_primary', true).maybeSingle();
    if (ph) primaryPhotoUrl = (await signedUrls('profile-photos', [ph.storage_path])).get(ph.storage_path) ?? null;
  }
  return { verification: { ...v, document_paths: canSeeDocs ? v.document_paths : [] }, events: events ?? [], documents, canSeeDocuments: canSeeDocs, primaryPhotoUrl };
}

export const verificationDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'resubmission_required', 'in_review']),
  reason: z.string().trim().max(1000).optional(),
}).refine((v) => v.decision === 'approved' || v.decision === 'in_review' || (v.reason && v.reason.length >= 5), { message: 'A reason is required.', path: ['reason'] });

export async function decideVerification(auth: AuthContext, id: string, input: z.infer<typeof verificationDecisionSchema>) {
  const c = db();
  const { data: v } = await c.from('verifications').select('id, profile_id, kind, status, profiles(owner_user_id)').eq('id', id).maybeSingle();
  if (!v) throw errors.notFound('Verification not found.');
  if (v.status === input.decision) throw errors.conflict('Verification already has this status.');
  const now = new Date().toISOString();
  await c.from('verifications').update({
    status: input.decision,
    reviewer_id: auth.userId,
    reviewed_at: input.decision === 'in_review' ? null : now,
    rejection_reason: input.decision === 'approved' || input.decision === 'in_review' ? null : input.reason ?? null,
  }).eq('id', id);
  await c.from('verification_events').insert({ verification_id: id, actor_user_id: auth.userId, from_status: v.status, to_status: input.decision, note: input.reason ?? null });

  // Profile trust flags reflect the latest decision for identity/photo checks.
  if (v.kind === 'government_id' || v.kind === 'photo') {
    const flag = (value: boolean) => (v.kind === 'government_id' ? { is_identity_verified: value } : { is_photo_verified: value });
    if (input.decision === 'approved') await c.from('profiles').update(flag(true)).eq('id', v.profile_id);
    else if (v.status === 'approved') await c.from('profiles').update(flag(false)).eq('id', v.profile_id);
  }

  const ownerId = (v.profiles as unknown as { owner_user_id: string } | null)?.owner_user_id;
  const kindLabel = VERIFICATION_KIND_LABELS[v.kind as VerificationKind]?.toLowerCase() ?? v.kind;
  if (ownerId && input.decision === 'approved') {
    await notify({ userId: ownerId, category: 'verification', templateKey: 'verification_approved', vars: { kind: kindLabel }, data: { href: '/app/verification' } });
  } else if (ownerId && (input.decision === 'rejected' || input.decision === 'resubmission_required')) {
    await notify({ userId: ownerId, category: 'verification', templateKey: 'verification_rejected', vars: { kind: kindLabel, reason: input.reason }, data: { href: '/app/verification' } });
  }
  await audit(auth, { action: `admin.verification.${input.decision}`, entityType: 'verification', entityId: id, before: { status: v.status }, after: { status: input.decision, reason: input.reason ?? null } });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export async function listReports(req: Request, p: Page, auth: AuthContext) {
  const status = qp(req, 'status') ?? 'open';
  const priority = qp(req, 'priority');
  const mine = qp(req, 'mine') === 'true';
  let query = db()
    .from('reports')
    .select('id, reason, status, priority, created_at, assigned_to, target_profile_id, target_message_id, target_photo_id, profiles!reports_target_profile_id_fkey(profile_code, first_name)', { count: 'exact' })
    .order('created_at', { ascending: true })
    .range(p.offset, p.offset + p.limit - 1);
  query = status === 'open' ? query.in('status', ['open', 'in_review']) : status === 'all' ? query : query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (mine) query = query.eq('assigned_to', auth.userId);
  const { data, count, error } = await query;
  if (error) throw error;
  return paged(
    (data ?? []).map((r) => {
      const prof = r.profiles as unknown as { profile_code: string; first_name: string | null } | null;
      return { ...r, profiles: undefined, targetCode: prof?.profile_code ?? null, targetName: prof?.first_name ?? null, assignedToMe: r.assigned_to === auth.userId, kind: r.target_message_id ? 'message' : r.target_photo_id ? 'photo' : 'profile' };
    }),
    count,
    p,
  );
}

export async function getReport(id: string) {
  const c = db();
  const { data: r } = await c.from('reports').select('*').eq('id', id).maybeSingle();
  if (!r) throw errors.notFound('Report not found.');
  const [target, reporter, message, photo, priorReports, history] = await Promise.all([
    r.target_profile_id ? c.from('profiles').select('id, owner_user_id, profile_code, first_name, last_name, status, current_city, about, is_identity_verified, created_at').eq('id', r.target_profile_id).maybeSingle() : Promise.resolve({ data: null }),
    r.reporter_profile_id ? c.from('profiles').select('id, profile_code, first_name').eq('id', r.reporter_profile_id).maybeSingle() : Promise.resolve({ data: null }),
    // Only the reported message — never the surrounding conversation.
    r.target_message_id ? c.from('messages').select('id, body, kind, created_at, flagged, deleted_at, sender_profile_id').eq('id', r.target_message_id).maybeSingle() : Promise.resolve({ data: null }),
    r.target_photo_id ? c.from('profile_photos').select('id, storage_path, moderation_status').eq('id', r.target_photo_id).maybeSingle() : Promise.resolve({ data: null }),
    r.target_profile_id ? c.from('reports').select('id', { count: 'exact', head: true }).eq('target_profile_id', r.target_profile_id) : Promise.resolve({ count: 0 }),
    c.from('moderation_actions').select('id, action, reason, created_at, admin_user_id').eq('report_id', id).order('created_at'),
  ]);
  const photoRow = photo.data as { id: string; storage_path: string; moderation_status: string } | null;
  const photoUrl = photoRow ? (await signedUrls('profile-photos', [photoRow.storage_path])).get(photoRow.storage_path) ?? null : null;
  return {
    report: r,
    target: target.data,
    reporter: reporter.data,
    message: message.data,
    photo: photoRow ? { id: photoRow.id, url: photoUrl, moderationStatus: photoRow.moderation_status } : null,
    totalReportsAgainstTarget: (priorReports as { count: number | null }).count ?? 0,
    actions: history.data ?? [],
  };
}

export const reportUpdateSchema = z.object({
  status: z.enum(['open', 'in_review', 'actioned', 'dismissed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignToMe: z.boolean().optional(),
  unassign: z.boolean().optional(),
  resolution: z.string().trim().max(2000).optional(),
});

export async function updateReport(auth: AuthContext, id: string, input: z.infer<typeof reportUpdateSchema>) {
  const c = db();
  const { data: before } = await c.from('reports').select('status, priority, assigned_to, resolution').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Report not found.');
  if ((input.status === 'dismissed' || input.status === 'actioned') && !input.resolution && !before.resolution) {
    throw errors.validation('Add a resolution note when closing a report.');
  }
  const patch: Database['public']['Tables']['reports']['Update'] = {};
  if (input.status) patch.status = input.status;
  if (input.priority) patch.priority = input.priority;
  if (input.assignToMe) patch.assigned_to = auth.userId;
  if (input.unassign) patch.assigned_to = null;
  if (input.resolution !== undefined) patch.resolution = input.resolution;
  if (input.status === 'dismissed' || input.status === 'actioned') patch.resolved_at = new Date().toISOString();
  if (input.status === 'in_review' && !before.assigned_to && !input.unassign) patch.assigned_to = auth.userId;
  await c.from('reports').update(patch).eq('id', id);
  await audit(auth, { action: 'admin.report.update', entityType: 'report', entityId: id, before, after: patch });
}

// ---------------------------------------------------------------------------
// Moderation actions (human decisions)
// ---------------------------------------------------------------------------
export const moderationActionSchema = z.object({
  action: z.enum(['warn', 'hide_profile', 'suspend', 'reinstate', 'ban', 'remove_photo', 'remove_video', 'remove_message', 'clear_flag']),
  reason: reasonSchema,
  targetProfileId: z.uuid().optional(),
  reportId: z.uuid().optional(),
  photoId: z.uuid().optional(),
  videoId: z.uuid().optional(),
  messageId: z.uuid().optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});

export async function takeModerationAction(auth: AuthContext, input: z.infer<typeof moderationActionSchema>) {
  const c = db();
  let profileId = input.targetProfileId ?? null;
  if (!profileId && input.reportId) {
    const { data: r } = await c.from('reports').select('target_profile_id').eq('id', input.reportId).maybeSingle();
    profileId = r?.target_profile_id ?? null;
  }
  const { data: prof } = profileId ? await c.from('profiles').select('id, owner_user_id, status').eq('id', profileId).maybeSingle() : { data: null };
  const userId = prof?.owner_user_id ?? null;
  const needUser = ['warn', 'hide_profile', 'suspend', 'reinstate', 'ban'];
  if (needUser.includes(input.action) && !userId) throw errors.validation('This action needs a target profile.');

  let logged = false; // suspend/ban/reinstate write their own moderation_actions row
  switch (input.action) {
    case 'warn':
      await notify({ userId: userId!, category: 'security', templateKey: 'moderation_warning', vars: { reason: input.reason }, forceChannels: [] });
      break;
    case 'hide_profile':
      await c.from('profiles').update({ status: 'hidden' }).eq('id', profileId!);
      break;
    case 'suspend':
      await suspendUser(auth, userId!, { reason: input.reason, until: input.expiresAt ?? null }, { reportId: input.reportId ?? null });
      logged = true;
      break;
    case 'ban':
      await suspendUser(auth, userId!, { reason: input.reason, until: null }, { ban: true, reportId: input.reportId ?? null });
      logged = true;
      break;
    case 'reinstate': {
      const { data: u } = await c.from('app_users').select('status').eq('id', userId!).maybeSingle();
      if (u?.status === 'suspended') {
        await reactivateUser(auth, userId!, input.reason, input.reportId ?? null);
        logged = true;
      } else if (prof?.status === 'hidden') {
        await c.from('profiles').update({ status: 'active' }).eq('id', profileId!);
      } else throw errors.conflict('Nothing to reinstate.');
      break;
    }
    case 'remove_photo': {
      if (!input.photoId) throw errors.validation('photoId is required.');
      await c.from('profile_photos').update({ moderation_status: 'rejected', moderation_reason: input.reason, moderated_by: auth.userId, moderated_at: new Date().toISOString(), is_primary: false }).eq('id', input.photoId);
      if (userId) await notify({ userId, category: 'verification', templateKey: 'moderation_media_removed', vars: { kind: 'photo', reason: input.reason } });
      break;
    }
    case 'remove_video': {
      if (!input.videoId) throw errors.validation('videoId is required.');
      await c.from('profile_videos').update({ moderation_status: 'rejected', moderation_reason: input.reason, moderated_by: auth.userId, moderated_at: new Date().toISOString() }).eq('id', input.videoId);
      if (userId) await notify({ userId, category: 'verification', templateKey: 'moderation_media_removed', vars: { kind: 'video', reason: input.reason } });
      break;
    }
    case 'remove_message':
      if (!input.messageId) throw errors.validation('messageId is required.');
      await c.from('messages').update({ deleted_at: new Date().toISOString(), flagged: true }).eq('id', input.messageId);
      break;
    case 'clear_flag':
      if (!input.messageId) throw errors.validation('messageId is required.');
      await c.from('messages').update({ flagged: false }).eq('id', input.messageId);
      break;
  }
  if (!logged) {
    await c.from('moderation_actions').insert({ admin_user_id: auth.userId, target_user_id: userId, target_profile_id: profileId, report_id: input.reportId ?? null, action: input.action, reason: input.reason, expires_at: input.expiresAt ?? null });
  }
  if (input.reportId) {
    await c.from('reports').update({ status: 'actioned', resolution: `${input.action}: ${input.reason}`, resolved_at: new Date().toISOString() }).eq('id', input.reportId).in('status', ['open', 'in_review']);
  }
  await audit(auth, { action: `admin.moderation.${input.action}`, entityType: input.messageId ? 'message' : input.photoId ? 'profile_photo' : input.videoId ? 'profile_video' : 'profile', entityId: input.messageId ?? input.photoId ?? input.videoId ?? profileId, after: input });
}

export async function listModerationActions(req: Request, p: Page) {
  const { data, count, error } = await db().from('moderation_actions').select('id, action, reason, expires_at, created_at, admin_user_id, target_user_id, target_profile_id, report_id', { count: 'exact' }).order('created_at', { ascending: false }).range(p.offset, p.offset + p.limit - 1);
  if (error) throw error;
  return paged(data ?? [], count, p);
}

// ---------------------------------------------------------------------------
// Risk signals (automated — reviewed by humans, never auto-enforced)
// ---------------------------------------------------------------------------
export async function listRiskSignals(req: Request, p: Page) {
  const status = qp(req, 'status') ?? 'open';
  let query = db().from('risk_signals').select('id, user_id, profile_id, kind, severity, details, status, reviewed_at, created_at, profiles(profile_code, first_name)', { count: 'exact' }).order('severity', { ascending: false }).order('created_at', { ascending: true }).range(p.offset, p.offset + p.limit - 1);
  if (status !== 'all') query = query.eq('status', status);
  const { data, count, error } = await query;
  if (error) throw error;
  return paged((data ?? []).map((r) => ({ ...r, profiles: undefined, profileCode: (r.profiles as unknown as { profile_code: string } | null)?.profile_code ?? null })), count, p);
}

export const riskUpdateSchema = z.object({ status: z.enum(['reviewed_ok', 'actioned', 'dismissed']), note: z.string().trim().max(500).optional() });

export async function reviewRiskSignal(auth: AuthContext, id: string, input: z.infer<typeof riskUpdateSchema>) {
  const c = db();
  const { data: before } = await c.from('risk_signals').select('status').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Signal not found.');
  await c.from('risk_signals').update({ status: input.status, reviewed_by: auth.userId, reviewed_at: new Date().toISOString() }).eq('id', id);
  await audit(auth, { action: 'admin.risk.review', entityType: 'risk_signal', entityId: id, before, after: input });
}

/** Signed URL for an admin to inspect a stored object (used by the profile media viewer). */
export async function adminSignedUrl(bucket: Bucket, path: string) {
  return (await signedUrls(bucket, [path], 600)).get(path) ?? null;
}
