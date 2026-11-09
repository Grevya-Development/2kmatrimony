import 'server-only';
import { z } from 'zod';
import { BILLING_INTERVALS, DEFAULT_ENTITLEMENTS, type Entitlements } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { ApiError, errors } from '@/server/http';
import { processRefund } from '@/server/billing/refunds';
import { paged, qp, reasonSchema, type Page } from './common';

// ---------------------------------------------------------------------------
// Subscriptions & payments (read)
// ---------------------------------------------------------------------------
export async function listSubscriptions(req: Request, p: Page) {
  const status = qp(req, 'status');
  const plan = qp(req, 'plan');
  let planId: string | null = null;
  if (plan) planId = (await db().from('plans').select('id').eq('code', plan).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000';
  let query = db().from('subscriptions').select('id, user_id, status, current_period_start, current_period_end, cancel_at_period_end, auto_renew, granted_by_admin, razorpay_subscription_id, created_at, plans(code, name), app_users(full_name)', { count: 'exact' }).order('created_at', { ascending: false }).range(p.offset, p.offset + p.limit - 1);
  if (status) query = query.eq('status', status);
  if (planId) query = query.eq('plan_id', planId);
  const { data, count, error } = await query;
  if (error) throw error;
  return paged((data ?? []).map((s) => ({ ...s, plan: s.plans as unknown as { code: string; name: string } | null, member: (s.app_users as unknown as { full_name: string | null } | null)?.full_name ?? null, plans: undefined, app_users: undefined })), count, p);
}

export async function listPayments(req: Request, p: Page) {
  const status = qp(req, 'status');
  const from = qp(req, 'from');
  const to = qp(req, 'to');
  let query = db().from('payments').select('id, user_id, status, amount_paise, list_amount_paise, discount_paise, gst_paise, method, razorpay_order_id, razorpay_payment_id, paid_at, created_at, plans(code, name), app_users(full_name)', { count: 'exact' }).order('created_at', { ascending: false }).range(p.offset, p.offset + p.limit - 1);
  if (status) query = query.eq('status', status);
  if (from) query = query.gte('created_at', `${from}T00:00:00Z`);
  if (to) query = query.lt('created_at', new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400_000).toISOString());
  const { data, count, error } = await query;
  if (error) throw error;
  return paged((data ?? []).map((x) => ({ ...x, plan: x.plans as unknown as { code: string; name: string } | null, member: (x.app_users as unknown as { full_name: string | null } | null)?.full_name ?? null, plans: undefined, app_users: undefined })), count, p);
}

export async function getPayment(id: string) {
  const c = db();
  const { data: payment } = await c.from('payments').select('*, plans(code, name), coupons(code)').eq('id', id).maybeSingle();
  if (!payment) throw errors.notFound('Payment not found.');
  const [{ data: invoice }, { data: refunds }, { data: user }] = await Promise.all([
    c.from('invoices').select('*').eq('payment_id', id).maybeSingle(),
    c.from('refunds').select('*').eq('payment_id', id).order('created_at', { ascending: false }),
    c.from('app_users').select('id, full_name, status').eq('id', payment.user_id).maybeSingle(),
  ]);
  return { payment, invoice, refunds: refunds ?? [], member: user };
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------
export async function listRefunds(req: Request, p: Page) {
  const status = qp(req, 'status');
  let query = db().from('refunds').select('id, payment_id, amount_paise, reason, status, razorpay_refund_id, requested_by, approved_by, notes, created_at, updated_at', { count: 'exact' }).order('created_at', { ascending: false }).range(p.offset, p.offset + p.limit - 1);
  if (status) query = query.eq('status', status);
  const { data, count, error } = await query;
  if (error) throw error;
  return paged(data ?? [], count, p);
}

export const refundRequestSchema = z.object({ paymentId: z.uuid(), amountPaise: z.number().int().positive(), reason: reasonSchema });

export async function requestRefund(auth: AuthContext, input: z.infer<typeof refundRequestSchema>) {
  const c = db();
  const { data: pay } = await c.from('payments').select('id, amount_paise, status').eq('id', input.paymentId).maybeSingle();
  if (!pay) throw errors.notFound('Payment not found.');
  if (!['captured', 'partially_refunded'].includes(pay.status)) throw errors.conflict('Only captured payments can be refunded.');
  const { data: existing } = await c.from('refunds').select('amount_paise, status').eq('payment_id', pay.id).in('status', ['requested', 'approved', 'processing', 'processed']);
  const committed = (existing ?? []).reduce((s, r) => s + r.amount_paise, 0);
  if (committed + input.amountPaise > pay.amount_paise) throw errors.validation(`Refund exceeds the refundable amount (₹${((pay.amount_paise - committed) / 100).toFixed(2)} remaining).`);
  const { data, error } = await c.from('refunds').insert({ payment_id: pay.id, amount_paise: input.amountPaise, reason: input.reason, status: 'requested', requested_by: auth.userId }).select('id').single();
  if (error) throw error;
  await audit(auth, { action: 'admin.refund.request', entityType: 'refund', entityId: data.id, after: input });
  return data;
}

/** Record approval, then attempt processing via the billing integration. */
export async function approveRefund(auth: AuthContext, id: string) {
  const c = db();
  const { data: r } = await c.from('refunds').select('id, status, requested_by, amount_paise, payment_id').eq('id', id).maybeSingle();
  if (!r) throw errors.notFound('Refund not found.');
  if (r.status !== 'requested' && r.status !== 'approved' && r.status !== 'failed') throw errors.conflict(`Refund is already ${r.status}.`);
  if (r.status === 'requested') {
    await c.from('refunds').update({ status: 'approved', approved_by: auth.userId }).eq('id', id);
    await audit(auth, { action: 'admin.refund.approve', entityType: 'refund', entityId: id, before: { status: r.status }, after: { status: 'approved' } });
  }
  try {
    await processRefund(id, auth);
    const { data: after } = await c.from('refunds').select('status, razorpay_refund_id').eq('id', id).maybeSingle();
    return { approved: true, processing: { ok: true, status: after?.status ?? 'processing', message: null as string | null } };
  } catch (err) {
    if (err instanceof ApiError) return { approved: true, processing: { ok: false, status: 'approved', message: err.message } };
    throw err;
  }
}

export async function rejectRefund(auth: AuthContext, id: string, reason: string) {
  const c = db();
  const { data: r } = await c.from('refunds').select('status, notes').eq('id', id).maybeSingle();
  if (!r) throw errors.notFound('Refund not found.');
  if (r.status !== 'requested' && r.status !== 'approved') throw errors.conflict(`Refund is already ${r.status}.`);
  await c.from('refunds').update({ status: 'rejected', notes: reason, approved_by: auth.userId }).eq('id', id);
  await audit(auth, { action: 'admin.refund.reject', entityType: 'refund', entityId: id, before: r, after: { status: 'rejected', notes: reason } });
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
const couponBase = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, - and _ only'),
  description: z.string().trim().max(300).nullish(),
  discountType: z.enum(['percent', 'flat']),
  discountValue: z.number().int().positive(),
  maxRedemptions: z.number().int().positive().nullish(),
  perUserLimit: z.number().int().min(1).max(100).default(1),
  planCodes: z.array(z.enum(['plus', 'premium', 'elite'])).default([]),
  validFrom: z.iso.datetime({ offset: true }).optional(),
  validUntil: z.iso.datetime({ offset: true }).nullish(),
  isActive: z.boolean().default(true),
});
export const couponSchema = couponBase.refine((v) => v.discountType !== 'percent' || v.discountValue <= 100, { message: 'Percent discounts cannot exceed 100.', path: ['discountValue'] });
export const couponPatchSchema = couponBase.partial().refine((v) => v.discountType !== 'percent' || v.discountValue === undefined || v.discountValue <= 100, { message: 'Percent discounts cannot exceed 100.', path: ['discountValue'] });

const couponRow = (v: Partial<z.infer<typeof couponSchema>>) => ({
  ...(v.code !== undefined && { code: v.code.toUpperCase() }),
  ...(v.description !== undefined && { description: v.description ?? null }),
  ...(v.discountType !== undefined && { discount_type: v.discountType }),
  ...(v.discountValue !== undefined && { discount_value: v.discountValue }),
  ...(v.maxRedemptions !== undefined && { max_redemptions: v.maxRedemptions ?? null }),
  ...(v.perUserLimit !== undefined && { per_user_limit: v.perUserLimit }),
  ...(v.planCodes !== undefined && { plan_codes: v.planCodes }),
  ...(v.validFrom !== undefined && { valid_from: v.validFrom }),
  ...(v.validUntil !== undefined && { valid_until: v.validUntil ?? null }),
  ...(v.isActive !== undefined && { is_active: v.isActive }),
});

export async function listCoupons() {
  const { data, error } = await db().from('coupons').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCoupon(auth: AuthContext, input: z.infer<typeof couponSchema>) {
  const { data, error } = await db().from('coupons').insert({ ...couponRow(input), code: input.code.toUpperCase(), discount_type: input.discountType, discount_value: input.discountValue, created_by: auth.userId }).select('*').single();
  if (error) {
    if (error.code === '23505') throw errors.conflict('A coupon with this code already exists.');
    throw error;
  }
  await audit(auth, { action: 'admin.coupon.create', entityType: 'coupon', entityId: data.id, after: data });
  return data;
}

export async function updateCoupon(auth: AuthContext, id: string, input: Partial<z.infer<typeof couponSchema>>) {
  const c = db();
  const { data: before } = await c.from('coupons').select('*').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Coupon not found.');
  const patch = couponRow(input);
  const { data, error } = await c.from('coupons').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  await audit(auth, { action: 'admin.coupon.update', entityType: 'coupon', entityId: id, before, after: data });
  return data;
}

export async function deleteCoupon(auth: AuthContext, id: string) {
  const c = db();
  const { data: before } = await c.from('coupons').select('*').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Coupon not found.');
  // Coupons with redemptions are deactivated (kept for invoice history), otherwise deleted.
  if (before.redeemed_count > 0) await c.from('coupons').update({ is_active: false }).eq('id', id);
  else await c.from('coupons').delete().eq('id', id);
  await audit(auth, { action: before.redeemed_count > 0 ? 'admin.coupon.deactivate' : 'admin.coupon.delete', entityType: 'coupon', entityId: id, before });
}

// ---------------------------------------------------------------------------
// Plans, prices, entitlements
// ---------------------------------------------------------------------------
export async function listPlansAdmin() {
  const { data, error } = await db().from('plans').select('*, plan_prices(*), plan_entitlements(key, value)').order('sort_order');
  if (error) throw error;
  return { plans: data ?? [], entitlementKeys: Object.entries(DEFAULT_ENTITLEMENTS).map(([key, v]) => ({ key, type: typeof v, default: v })) };
}

export const planCreateSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(120).nullish(),
  description: z.string().trim().max(1000).nullish(),
  sortOrder: z.number().int().min(0).max(100).default(10),
  isPublic: z.boolean().default(true),
});
export const planUpdateSchema = planCreateSchema.omit({ code: true }).partial().extend({ isActive: z.boolean().optional() });

export async function createPlan(auth: AuthContext, input: z.infer<typeof planCreateSchema>) {
  const { data, error } = await db().from('plans').insert({ code: input.code, name: input.name, tagline: input.tagline ?? null, description: input.description ?? null, sort_order: input.sortOrder, is_public: input.isPublic }).select('*').single();
  if (error) {
    if (error.code === '23505') throw errors.conflict('Plan code already exists.');
    throw error;
  }
  await audit(auth, { action: 'admin.plan.create', entityType: 'plan', entityId: data.id, after: data });
  return data;
}

export async function updatePlan(auth: AuthContext, id: string, input: z.infer<typeof planUpdateSchema>) {
  const c = db();
  const { data: before } = await c.from('plans').select('*').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Plan not found.');
  if (before.code === 'free' && input.isActive === false) throw errors.conflict('The Free plan cannot be deactivated.');
  const patch = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.tagline !== undefined && { tagline: input.tagline ?? null }),
    ...(input.description !== undefined && { description: input.description ?? null }),
    ...(input.sortOrder !== undefined && { sort_order: input.sortOrder }),
    ...(input.isPublic !== undefined && { is_public: input.isPublic }),
    ...(input.isActive !== undefined && { is_active: input.isActive }),
  };
  const { data, error } = await c.from('plans').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  await audit(auth, { action: 'admin.plan.update', entityType: 'plan', entityId: id, before, after: data });
  return data;
}

export const priceSchema = z.object({
  interval: z.enum(BILLING_INTERVALS),
  amountPaise: z.number().int().min(100).max(100_000_000),
  razorpayPlanId: z.string().trim().max(60).nullish(),
  isActive: z.boolean().default(true),
});

export async function upsertPrice(auth: AuthContext, planId: string, input: z.infer<typeof priceSchema>) {
  const c = db();
  const { data: plan } = await c.from('plans').select('code').eq('id', planId).maybeSingle();
  if (!plan) throw errors.notFound('Plan not found.');
  if (plan.code === 'free') throw errors.conflict('The Free plan has no prices.');
  const { data: before } = await c.from('plan_prices').select('*').eq('plan_id', planId).eq('interval', input.interval).maybeSingle();
  const { data, error } = await c.from('plan_prices').upsert({ plan_id: planId, interval: input.interval, amount_paise: input.amountPaise, razorpay_plan_id: input.razorpayPlanId ?? null, is_active: input.isActive }, { onConflict: 'plan_id,interval' }).select('*').single();
  if (error) throw error;
  await audit(auth, { action: 'admin.plan.price.upsert', entityType: 'plan_price', entityId: data.id, before, after: data });
  return data;
}

export const entitlementsSchema = z.object({ values: z.record(z.string(), z.union([z.boolean(), z.number().int().min(0).max(100000), z.string().max(40)])) });

export async function setEntitlements(auth: AuthContext, planId: string, values: Record<string, unknown>) {
  const c = db();
  const { data: plan } = await c.from('plans').select('id').eq('id', planId).maybeSingle();
  if (!plan) throw errors.notFound('Plan not found.');
  const defaults = DEFAULT_ENTITLEMENTS as unknown as Record<string, unknown>;
  const rows: { plan_id: string; key: string; value: boolean | number | string }[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!(key in defaults)) throw errors.validation(`Unknown entitlement "${key}".`);
    if (typeof value !== typeof defaults[key]) throw errors.validation(`Entitlement "${key}" must be a ${typeof defaults[key]}.`);
    if (key === 'ai_insights' && !['none', 'basic', 'full'].includes(value as string)) throw errors.validation('ai_insights must be none, basic or full.');
    rows.push({ plan_id: planId, key, value: value as Entitlements[keyof Entitlements] });
  }
  const { data: before } = await c.from('plan_entitlements').select('key, value').eq('plan_id', planId);
  if (rows.length) {
    const { error } = await c.from('plan_entitlements').upsert(rows, { onConflict: 'plan_id,key' });
    if (error) throw error;
  }
  await audit(auth, { action: 'admin.plan.entitlements.update', entityType: 'plan', entityId: planId, before, after: values });
}
