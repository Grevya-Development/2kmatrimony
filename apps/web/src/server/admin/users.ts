import 'server-only';
import { z } from 'zod';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { errors } from '@/server/http';
import { getSetting } from '@/server/config';
import { likeSafe, maskEmail, maskPhone, paged, qp, reasonSchema, type Page } from './common';

export const suspendSchema = z.object({ reason: reasonSchema, until: z.iso.datetime({ offset: true }).nullish() });
export const deleteUserSchema = z.object({ reason: reasonSchema, confirm: z.literal('DELETE') });
export const subscriptionActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('grant'), planCode: z.enum(['plus', 'premium', 'elite']), days: z.number().int().min(1).max(730), reason: reasonSchema }),
  z.object({ action: z.literal('extend'), days: z.number().int().min(1).max(730), reason: reasonSchema }),
  z.object({ action: z.literal('cancel'), reason: reasonSchema }),
]);

async function activePlanByUser(userIds: string[]): Promise<Map<string, { code: string; name: string; end: string | null }>> {
  const out = new Map<string, { code: string; name: string; end: string | null }>();
  if (!userIds.length) return out;
  const { data } = await db()
    .from('subscriptions')
    .select('user_id, current_period_end, plans(code, name)')
    .in('user_id', userIds)
    .eq('status', 'active')
    .gt('current_period_end', new Date().toISOString());
  for (const s of data ?? []) {
    const p = s.plans as unknown as { code: string; name: string } | null;
    if (p) out.set(s.user_id, { code: p.code, name: p.name, end: s.current_period_end });
  }
  return out;
}

/** Search + filter users. Contact details are masked in lists. */
export async function listUsers(req: Request, p: Page) {
  const c = db();
  const q = qp(req, 'q');
  const status = qp(req, 'status');
  const plan = qp(req, 'plan');
  const verified = qp(req, 'verified');
  const from = qp(req, 'from');
  const to = qp(req, 'to');

  let restrictIds: string[] | null = null;
  if (q && /^tk\d+$/i.test(q)) {
    const { data } = await c.from('profiles').select('owner_user_id').eq('profile_code', q.toUpperCase());
    restrictIds = (data ?? []).map((r) => r.owner_user_id);
  } else if (q) {
    const s = likeSafe(q);
    const { data: prof } = await c.from('profiles').select('owner_user_id').or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%`).limit(200);
    const { data: usr } = await c.from('app_users').select('id').or(`email.ilike.%${s}%,phone.ilike.%${s}%,full_name.ilike.%${s}%`).limit(200);
    restrictIds = [...new Set([...(prof ?? []).map((r) => r.owner_user_id), ...(usr ?? []).map((r) => r.id)])];
  }
  if (plan) {
    let ids: string[] = [];
    if (plan === 'free') {
      // Free = users without an active paid subscription.
      const { data: paid } = await c.from('subscriptions').select('user_id').eq('status', 'active').gt('current_period_end', new Date().toISOString());
      const paidSet = new Set((paid ?? []).map((r) => r.user_id));
      const { data: all } = await c.from('app_users').select('id').limit(5000);
      ids = (all ?? []).map((r) => r.id).filter((id) => !paidSet.has(id));
    } else {
      const { data: pl } = await c.from('plans').select('id').eq('code', plan).maybeSingle();
      const { data: subs } = pl ? await c.from('subscriptions').select('user_id').eq('plan_id', pl.id).eq('status', 'active').gt('current_period_end', new Date().toISOString()) : { data: [] };
      ids = (subs ?? []).map((r) => r.user_id);
    }
    restrictIds = restrictIds ? restrictIds.filter((id) => ids.includes(id)) : ids;
  }
  if (verified === 'true' || verified === 'false') {
    const { data } = await c.from('profiles').select('owner_user_id').eq('is_identity_verified', verified === 'true');
    const ids = (data ?? []).map((r) => r.owner_user_id);
    restrictIds = restrictIds ? restrictIds.filter((id) => ids.includes(id)) : ids;
  }
  if (restrictIds && restrictIds.length === 0) return paged([], 0, p);

  let query = c
    .from('app_users')
    .select('id, email, phone, full_name, status, created_at, last_active_at, onboarding_completed_at, profiles(id, profile_code, first_name, last_name, status, completion_pct, is_identity_verified, is_photo_verified)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(p.offset, p.offset + p.limit - 1);
  if (restrictIds) query = query.in('id', restrictIds.slice(0, 1000));
  if (status) query = query.eq('status', status);
  if (from) query = query.gte('created_at', `${from}T00:00:00Z`);
  if (to) query = query.lt('created_at', new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400_000).toISOString());
  const { data, count, error } = await query;
  if (error) throw error;
  const plans = await activePlanByUser((data ?? []).map((u) => u.id));

  return paged(
    (data ?? []).map((u) => {
      const prof = (Array.isArray(u.profiles) ? u.profiles[0] : u.profiles) as {
        id: string; profile_code: string; first_name: string | null; last_name: string | null; status: string; completion_pct: number; is_identity_verified: boolean; is_photo_verified: boolean;
      } | null;
      return {
        id: u.id,
        name: u.full_name ?? ([prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || null),
        email: maskEmail(u.email),
        phone: maskPhone(u.phone),
        status: u.status,
        createdAt: u.created_at,
        lastActiveAt: u.last_active_at,
        plan: plans.get(u.id)?.code ?? 'free',
        profile: prof ? { id: prof.id, code: prof.profile_code, status: prof.status, completion: prof.completion_pct, identityVerified: prof.is_identity_verified, photoVerified: prof.is_photo_verified } : null,
      };
    }),
    count,
    p,
  );
}

export async function getUserDetail(userId: string) {
  const c = db();
  const { data: user } = await c.from('app_users').select('id, email, phone, full_name, status, suspended_reason, suspended_until, preferred_locale, created_at, last_active_at, onboarding_completed_at, deletion_requested_at, deleted_at, signup_ip').eq('id', userId).maybeSingle();
  if (!user) throw errors.notFound('User not found.');
  const { data: profile } = await c.from('profiles').select('id, profile_code, first_name, last_name, status, visibility, completion_pct, is_identity_verified, is_photo_verified, created_for, current_city, gender, created_at, activated_at').eq('owner_user_id', userId).maybeSingle();
  const pid = profile?.id ?? '00000000-0000-0000-0000-000000000000';
  const [subs, payments, reportsBy, reportsAgainst, actions, risks, auditRows, verifications, dataRequests] = await Promise.all([
    c.from('subscriptions').select('id, status, current_period_start, current_period_end, cancel_at_period_end, granted_by_admin, created_at, plans(code, name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    c.from('payments').select('id, amount_paise, status, method, paid_at, created_at, razorpay_payment_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    c.from('reports').select('id, reason, status, priority, created_at, target_profile_id').eq('reporter_user_id', userId).order('created_at', { ascending: false }).limit(20),
    c.from('reports').select('id, reason, status, priority, created_at, reporter_profile_id').eq('target_profile_id', pid).order('created_at', { ascending: false }).limit(20),
    c.from('moderation_actions').select('id, action, reason, expires_at, created_at, admin_user_id').or(`target_user_id.eq.${userId},target_profile_id.eq.${pid}`).order('created_at', { ascending: false }).limit(30),
    c.from('risk_signals').select('id, kind, severity, status, details, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    c.from('audit_logs').select('id, action, entity_type, entity_id, actor_user_id, actor_type, created_at, metadata').or(`actor_user_id.eq.${userId},entity_id.eq.${userId},entity_id.eq.${pid}`).order('created_at', { ascending: false }).limit(50),
    c.from('verifications').select('id, kind, status, created_at, reviewed_at').eq('profile_id', pid).order('created_at', { ascending: false }),
    c.from('data_requests').select('id, kind, status, scheduled_for, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ]);
  return {
    user: { ...user, email: maskEmail(user.email), phone: maskPhone(user.phone), signup_ip: null, hasEmail: !!user.email, hasPhone: !!user.phone },
    profile,
    subscriptions: (subs.data ?? []).map((s) => ({ ...s, plan: s.plans as unknown as { code: string; name: string } | null, plans: undefined })),
    payments: payments.data ?? [],
    reportsBy: reportsBy.data ?? [],
    reportsAgainst: reportsAgainst.data ?? [],
    moderation: actions.data ?? [],
    riskSignals: risks.data ?? [],
    activity: auditRows.data ?? [],
    verifications: verifications.data ?? [],
    dataRequests: dataRequests.data ?? [],
  };
}

/** Reveal unmasked contact details — sensitive, audited. */
export async function revealContact(auth: AuthContext, userId: string) {
  const { data } = await db().from('app_users').select('email, phone, signup_ip').eq('id', userId).maybeSingle();
  if (!data) throw errors.notFound('User not found.');
  await audit(auth, { action: 'admin.sensitive.view', entityType: 'app_user', entityId: userId, metadata: { fields: ['email', 'phone', 'signup_ip'] } });
  return { email: data.email, phone: data.phone, signupIp: data.signup_ip };
}

async function setAuthBan(userId: string, hours: number | 'none') {
  const { error } = await db().auth.admin.updateUserById(userId, { ban_duration: hours === 'none' ? 'none' : `${Math.max(1, Math.ceil(hours))}h` });
  if (error) console.error('[admin] auth ban update failed', error.message);
}

export async function suspendUser(auth: AuthContext, userId: string, input: z.infer<typeof suspendSchema>, opts: { ban?: boolean; reportId?: string | null } = {}) {
  if (userId === auth.userId) throw errors.conflict('You cannot suspend your own account.');
  const c = db();
  const { data: before } = await c.from('app_users').select('status, suspended_reason, suspended_until').eq('id', userId).maybeSingle();
  if (!before) throw errors.notFound('User not found.');
  if (before.status === 'deleted') throw errors.conflict('This account is deleted.');
  const until = opts.ban ? null : input.until ?? null;
  await c.from('app_users').update({ status: 'suspended', suspended_reason: input.reason, suspended_until: until }).eq('id', userId);
  const { data: profile } = await c.from('profiles').select('id, status').eq('owner_user_id', userId).maybeSingle();
  if (profile && profile.status !== 'deleted') await c.from('profiles').update({ status: 'suspended' }).eq('id', profile.id);
  const hours = until ? (new Date(until).getTime() - Date.now()) / 3600_000 : 24 * 365 * 100;
  await setAuthBan(userId, hours);
  await c.from('moderation_actions').insert({
    admin_user_id: auth.userId, target_user_id: userId, target_profile_id: profile?.id ?? null, report_id: opts.reportId ?? null,
    action: opts.ban ? 'ban' : 'suspend', reason: input.reason, expires_at: until,
  });
  await audit(auth, { action: opts.ban ? 'admin.user.ban' : 'admin.user.suspend', entityType: 'app_user', entityId: userId, before, after: { status: 'suspended', suspended_reason: input.reason, suspended_until: until } });
}

export async function reactivateUser(auth: AuthContext, userId: string, reason = 'Reinstated by admin', reportId: string | null = null) {
  const c = db();
  const { data: before } = await c.from('app_users').select('status, suspended_reason, suspended_until').eq('id', userId).maybeSingle();
  if (!before) throw errors.notFound('User not found.');
  if (before.status !== 'suspended') throw errors.conflict('Only suspended accounts can be reactivated.');
  await c.from('app_users').update({ status: 'active', suspended_reason: null, suspended_until: null }).eq('id', userId);
  const { data: profile } = await c.from('profiles').select('id, status, activated_at').eq('owner_user_id', userId).maybeSingle();
  if (profile && profile.status === 'suspended') await c.from('profiles').update({ status: profile.activated_at ? 'active' : 'draft' }).eq('id', profile.id);
  await setAuthBan(userId, 'none');
  await c.from('moderation_actions').insert({ admin_user_id: auth.userId, target_user_id: userId, target_profile_id: profile?.id ?? null, report_id: reportId, action: 'reinstate', reason });
  await audit(auth, { action: 'admin.user.reactivate', entityType: 'app_user', entityId: userId, before, after: { status: 'active' } });
}

/** Schedule deletion through the same data_requests pipeline used by members (executed by the privacy job). */
export async function scheduleUserDeletion(auth: AuthContext, userId: string, reason: string) {
  if (userId === auth.userId) throw errors.conflict('Use account settings to delete your own account.');
  const c = db();
  const { data: user } = await c.from('app_users').select('status').eq('id', userId).maybeSingle();
  if (!user) throw errors.notFound('User not found.');
  if (user.status === 'deleted') throw errors.conflict('Already deleted.');
  const { data: open } = await c.from('data_requests').select('id').eq('user_id', userId).eq('kind', 'deletion').in('status', ['pending', 'processing']).maybeSingle();
  if (open) throw errors.conflict('A deletion is already scheduled for this account.');
  const privacy = await getSetting('privacy', { deletion_grace_days: 14, export_link_hours: 24 });
  const scheduledFor = new Date(Date.now() + privacy.deletion_grace_days * 86400_000).toISOString();
  const { data: reqRow } = await c.from('data_requests').insert({ user_id: userId, kind: 'deletion', status: 'pending', scheduled_for: scheduledFor, notes: `Admin-initiated: ${reason}` }).select('id').single();
  const now = new Date().toISOString();
  await c.from('app_users').update({ status: 'pending_deletion', deletion_requested_at: now }).eq('id', userId);
  await c.from('profiles').update({ status: 'hidden' }).eq('owner_user_id', userId).neq('status', 'deleted');
  await audit(auth, { action: 'admin.user.delete_scheduled', entityType: 'app_user', entityId: userId, before: { status: user.status }, after: { status: 'pending_deletion', scheduledFor, requestId: reqRow?.id } , metadata: { reason } });
  return { scheduledFor };
}

export async function manageSubscription(auth: AuthContext, userId: string, input: z.infer<typeof subscriptionActionSchema>) {
  const c = db();
  const nowIso = new Date().toISOString();
  const { data: current } = await c.from('subscriptions').select('id, plan_id, status, current_period_end').eq('user_id', userId).eq('status', 'active').gt('current_period_end', nowIso).order('current_period_end', { ascending: false }).limit(1).maybeSingle();
  if (input.action === 'grant') {
    const { data: plan } = await c.from('plans').select('id').eq('code', input.planCode).maybeSingle();
    if (!plan) throw errors.notFound('Plan not found.');
    if (current) await c.from('subscriptions').update({ status: 'cancelled', cancelled_at: nowIso, current_period_end: nowIso }).eq('id', current.id);
    const end = new Date(Date.now() + input.days * 86400_000).toISOString();
    const { data: row, error } = await c.from('subscriptions').insert({ user_id: userId, plan_id: plan.id, status: 'active', current_period_start: nowIso, current_period_end: end, granted_by_admin: auth.userId }).select('id').single();
    if (error) throw error;
    await audit(auth, { action: 'admin.subscription.grant', entityType: 'subscription', entityId: row.id, before: current, after: { planCode: input.planCode, end }, metadata: { userId, reason: input.reason } });
    return { subscriptionId: row.id, currentPeriodEnd: end };
  }
  if (!current) throw errors.conflict('This member has no active paid subscription.');
  if (input.action === 'extend') {
    const end = new Date(new Date(current.current_period_end!).getTime() + input.days * 86400_000).toISOString();
    await c.from('subscriptions').update({ current_period_end: end }).eq('id', current.id);
    await audit(auth, { action: 'admin.subscription.extend', entityType: 'subscription', entityId: current.id, before: current, after: { current_period_end: end }, metadata: { userId, reason: input.reason } });
    return { subscriptionId: current.id, currentPeriodEnd: end };
  }
  await c.from('subscriptions').update({ status: 'cancelled', cancelled_at: nowIso, current_period_end: nowIso, auto_renew: false }).eq('id', current.id);
  await audit(auth, { action: 'admin.subscription.cancel', entityType: 'subscription', entityId: current.id, before: current, after: { status: 'cancelled' }, metadata: { userId, reason: input.reason } });
  return { subscriptionId: current.id, currentPeriodEnd: nowIso };
}
