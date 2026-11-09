import 'server-only';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { getSetting } from '@/server/config';
import { notify } from '@/server/notify';
import { rateLimit } from '@/server/rate-limit';

type Q = { table: string; column: string; select?: string };

/** Everything the member provided or that was generated about them (DPDP right to access). */
const USER_TABLES: Q[] = [
  { table: 'app_users', column: 'id', select: 'id, phone, email, full_name, preferred_locale, status, onboarding_completed_at, last_active_at, created_at' },
  { table: 'consent_records', column: 'user_id' },
  { table: 'user_devices', column: 'user_id', select: 'id, platform, device_name, app_version, last_seen_at, revoked_at, created_at' },
  { table: 'notifications', column: 'user_id' },
  { table: 'notification_preferences', column: 'user_id' },
  { table: 'subscriptions', column: 'user_id' },
  { table: 'payments', column: 'user_id' },
  { table: 'invoices', column: 'user_id' },
  { table: 'ai_threads', column: 'user_id' },
  { table: 'ai_feedback', column: 'user_id' },
  { table: 'support_tickets', column: 'user_id' },
  { table: 'data_requests', column: 'user_id' },
  { table: 'reports', column: 'reporter_user_id', select: 'id, reason, details, status, created_at' },
  { table: 'family_members', column: 'member_user_id', select: 'id, profile_id, relation, permissions, status, created_at' },
  { table: 'messages', column: 'sender_user_id', select: 'id, conversation_id, kind, body, created_at' },
];
const PROFILE_TABLES: Q[] = [
  { table: 'profiles', column: 'id', select: 'id, profile_code, created_for, managed_by_relation, first_name, last_name, name_visibility, date_of_birth, gender, height_cm, marital_status, has_children, mother_tongue, languages, nationality, religion, community, current_city, current_state, current_country, native_place, about, personality_traits, core_values, status, visibility, photo_visibility, sensitive_fields_visibility, messaging_policy, completion_pct, created_at, updated_at' },
  { table: 'profile_education', column: 'profile_id' },
  { table: 'profile_career', column: 'profile_id' },
  { table: 'profile_family', column: 'profile_id' },
  { table: 'profile_lifestyle', column: 'profile_id' },
  { table: 'profile_values', column: 'profile_id' },
  { table: 'relationship_dna', column: 'profile_id' },
  { table: 'question_responses', column: 'profile_id' },
  { table: 'partner_preferences', column: 'profile_id' },
  { table: 'profile_photos', column: 'profile_id', select: 'id, is_primary, visibility, moderation_status, created_at' },
  { table: 'profile_videos', column: 'profile_id', select: 'id, duration_seconds, visibility, moderation_status, created_at' },
  { table: 'verifications', column: 'profile_id', select: 'id, kind, status, document_type, submitted_data, attempt, created_at, reviewed_at' },
  { table: 'shortlists', column: 'owner_profile_id' },
  { table: 'passes', column: 'profile_id' },
  { table: 'blocks', column: 'blocker_profile_id' },
  { table: 'interests', column: 'sender_profile_id', select: 'id, receiver_profile_id, message, status, created_at' },
  { table: 'match_feedback', column: 'profile_id' },
  { table: 'readiness_notes', column: 'profile_id' },
  { table: 'connection_journal', column: 'author_profile_id' },
  { table: 'vision_board_items', column: 'author_profile_id' },
  { table: 'family_members', column: 'profile_id', select: 'id, invited_contact, relation, permissions, status, created_at' },
  { table: 'recommendations', column: 'profile_id', select: 'candidate_profile_id, score, source, status, batch_date' },
];

export async function buildExport(userId: string, profileId: string | null): Promise<Record<string, unknown>> {
  const c = db();
  const out: Record<string, unknown> = { generatedAt: new Date().toISOString(), userId, profileId, note: 'Personal data held by 2K Marriage about you. Other members\' private data is excluded.' };
  const run = async (q: Q, id: string, prefix: string) => {
    const { data, error } = await c.from(q.table as 'profiles').select(q.select ?? '*').eq(q.column, id).limit(5000);
    out[`${prefix}${q.table}`] = error ? { error: 'unavailable' } : data;
  };
  await Promise.all(USER_TABLES.map((q) => run(q, userId, q.table === 'family_members' ? 'as_member_' : '')));
  if (profileId) await Promise.all(PROFILE_TABLES.map((q) => run(q, profileId, q.table === 'family_members' ? 'as_owner_' : '')));
  const threadIds = ((out.ai_threads as { id: string }[] | undefined) ?? []).map((t) => t.id);
  if (threadIds.length) {
    const { data } = await c.from('ai_thread_messages').select('thread_id, role, content, created_at').in('thread_id', threadIds);
    out.ai_thread_messages = data ?? [];
  }
  return out;
}

export async function requestExport(auth: AuthContext) {
  await rateLimit(`privacy-export:${auth.userId}`, 3, 86_400);
  const c = db();
  const privacy = await getSetting('privacy', { deletion_grace_days: 14, export_link_hours: 24 });
  const { data: req, error } = await c.from('data_requests').insert({ user_id: auth.userId, kind: 'export', status: 'processing' }).select('id').single();
  if (error) throw error;
  try {
    const payload = await buildExport(auth.userId, auth.profile?.id ?? null);
    const path = `${auth.userId}/${req.id}.json`;
    const { error: upErr } = await c.storage.from('data-exports').upload(path, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), { contentType: 'application/json', upsert: true });
    if (upErr) throw upErr;
    const ttl = privacy.export_link_hours * 3600;
    const { data: signed, error: sErr } = await c.storage.from('data-exports').createSignedUrl(path, ttl, { download: `2k-marriage-data-${new Date().toISOString().slice(0, 10)}.json` });
    if (sErr || !signed) throw sErr ?? new Error('sign failed');
    await c.from('data_requests').update({ status: 'completed', result_path: path, completed_at: new Date().toISOString() }).eq('id', req.id);
    await audit(auth, { action: 'privacy.export', entityType: 'data_request', entityId: req.id });
    await notify({ userId: auth.userId, category: 'security', templateKey: 'data_export_ready', vars: { link: signed.signedUrl, hours: privacy.export_link_hours }, skipInApp: true });
    return { requestId: req.id, url: signed.signedUrl, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
  } catch (err) {
    await c.from('data_requests').update({ status: 'failed', notes: err instanceof Error ? err.message.slice(0, 200) : 'failed' }).eq('id', req.id);
    throw err;
  }
}

export async function listDataRequests(auth: AuthContext) {
  const { data } = await db().from('data_requests').select('id, kind, status, scheduled_for, completed_at, created_at').eq('user_id', auth.userId).order('created_at', { ascending: false }).limit(20);
  return (data ?? []).map((r) => ({ id: r.id, kind: r.kind, status: r.status, scheduledFor: r.scheduled_for, completedAt: r.completed_at, createdAt: r.created_at }));
}
