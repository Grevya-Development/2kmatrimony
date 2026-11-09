import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CheckoutOrder, PlanItem, BillingHistoryResponse } from '@2k/shared';

// Mock the Razorpay SDK — no network calls in tests.
const rzpMock = {
  orders: { create: vi.fn() },
  payments: { fetch: vi.fn(), refund: vi.fn() },
};
vi.mock('razorpay', () => ({ default: class { orders = rzpMock.orders; payments = rzpMock.payments; } }));

import { GET as plansGET } from '@/app/api/v1/plans/route';
import { POST as checkoutPOST } from '@/app/api/v1/billing/checkout/route';
import { POST as couponPOST } from '@/app/api/v1/billing/coupon-preview/route';
import { POST as verifyPOST } from '@/app/api/v1/billing/verify/route';
import { GET as historyGET } from '@/app/api/v1/billing/history/route';
import { GET as invoiceGET } from '@/app/api/v1/billing/invoices/[id]/route';
import { POST as webhookPOST } from '@/app/api/v1/webhooks/razorpay/route';
import { activatePayment } from '@/server/billing/activation';
import { processRefund } from '@/server/billing/refunds';
import { resetRazorpayClient } from '@/server/billing/razorpay';
import { hmacSha256Hex } from '@/server/billing/signatures';
import { getPlanState } from '@/server/entitlements';
import { getAuthContext } from '@/server/auth';
import { admin, call, request, type TestUser } from './helpers';
import { billingUser, cleanupBillingUsers, createPendingPayment } from './billing-helpers';

const invoiceHandler = invoiceGET as unknown as Parameters<typeof call>[0];
const users: TestUser[] = [];
const couponIds: string[] = [];
const rid = () => `pay_${randomUUID().slice(0, 12)}`;
const newUser = async (l: string) => { const u = await billingUser(l); users.push(u); return u; };

afterAll(async () => {
  await cleanupBillingUsers(users);
  if (couponIds.length) await admin().from('coupons').delete().in('id', couponIds);
});

describe('plans', () => {
  it('lists public plans with GST-inclusive prices and typed entitlements', async () => {
    const r = await call<PlanItem[]>(plansGET, request('/api/v1/plans'));
    expect(r.status).toBe(200);
    const codes = r.body.data!.map((p) => p.code);
    expect(codes).toEqual(['free', 'plus', 'premium', 'elite']);
    const premium = r.body.data!.find((p) => p.code === 'premium')!;
    const quarter = premium.prices.find((p) => p.interval === 'quarter')!;
    expect(quarter.monthlyEquivalentPaise).toBe(Math.round(quarter.amountPaise / 3));
    expect(premium.entitlements.before_you_meet).toBe(true);
    expect(r.body.data!.find((p) => p.code === 'free')!.prices).toEqual([]);
  });
});

describe('checkout without Razorpay credentials', () => {
  it('returns 503 service_unconfigured and writes no payment', async () => {
    delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET; resetRazorpayClient();
    const u = await newUser('co503');
    const r = await call(checkoutPOST, request('/api/v1/billing/checkout', { token: u.token, body: { planCode: 'plus', interval: 'month' } }));
    expect(r.status).toBe(503);
    expect(r.body.error?.code).toBe('service_unconfigured');
    const { count } = await admin().from('payments').select('id', { count: 'exact', head: true }).eq('user_id', u.userId);
    expect(count).toBe(0);
  });
  it('rejects the free plan at validation', async () => {
    const u = await newUser('cofree');
    const r = await call(checkoutPOST, request('/api/v1/billing/checkout', { token: u.token, body: { planCode: 'free', interval: 'month' } }));
    expect(r.status).toBe(422);
  });
});

describe('coupons', () => {
  it('previews a valid coupon and rejects ineligible ones', async () => {
    const code = `IT${randomUUID().slice(0, 6).toUpperCase()}`;
    const { data: c } = await admin().from('coupons').insert({ code, discount_type: 'percent', discount_value: 25, plan_codes: ['premium'] }).select('id').single();
    couponIds.push(c!.id);
    const u = await newUser('coupon');
    const ok = await call<{ discountPaise: number; amountPaise: number; listAmountPaise: number }>(couponPOST, request('/x', { token: u.token, body: { planCode: 'premium', interval: 'month', couponCode: code.toLowerCase() } }));
    expect(ok.status).toBe(200);
    expect(ok.body.data!.discountPaise).toBe(Math.round(ok.body.data!.listAmountPaise * 0.25));
    expect(ok.body.data!.amountPaise).toBe(ok.body.data!.listAmountPaise - ok.body.data!.discountPaise);
    const wrongPlan = await call(couponPOST, request('/x', { token: u.token, body: { planCode: 'plus', interval: 'month', couponCode: code } }));
    expect(wrongPlan.status).toBe(422);
    expect(wrongPlan.body.error?.message).toMatch(/does not apply/);
    const missing = await call(couponPOST, request('/x', { token: u.token, body: { planCode: 'plus', interval: 'month', couponCode: 'NOPE-NOT-REAL' } }));
    expect(missing.status).toBe(422);
  });
});

describe('activation (shared by verify + webhook)', () => {
  it('is idempotent under concurrent calls: one subscription, one invoice', async () => {
    const u = await newUser('race');
    const pay = await createPendingPayment(u, 'plus', 'month');
    const raceId = rid();
    const results = await Promise.all([activatePayment(pay.id, raceId, 'upi', 'verify'), activatePayment(pay.id, raceId, 'upi', 'webhook'), activatePayment(pay.id, raceId, 'upi', 'verify')]);
    expect(results.filter((r) => !r.already)).toHaveLength(1);
    const { count: subs } = await admin().from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', u.userId);
    const { data: invs } = await admin().from('invoices').select('invoice_number, total_paise, cgst_paise, sgst_paise, igst_paise, taxable_paise').eq('user_id', u.userId);
    expect(subs).toBe(1);
    expect(invs).toHaveLength(1);
    expect(invs![0]!.invoice_number).toMatch(/^INV\/\d{4}-\d{2}\/\d{6}$/);
    expect(invs![0]!.taxable_paise + invs![0]!.cgst_paise + invs![0]!.sgst_paise + invs![0]!.igst_paise).toBe(invs![0]!.total_paise);
    const plan = await getPlanState(u.userId);
    expect(plan.code).toBe('plus');
    expect(plan.entitlements.advanced_filters).toBe(true);
    const { data: notes } = await admin().from('notifications').select('type').eq('user_id', u.userId);
    expect(notes!.filter((n) => n.type === 'subscription_activated')).toHaveLength(1);
  });

  it('extends the same plan from its current end, and an upgrade supersedes it', async () => {
    const u = await newUser('extend');
    const first = await activatePayment((await createPendingPayment(u, 'plus', 'month')).id, rid(), 'card', 'verify');
    const { data: s1 } = await admin().from('subscriptions').select('current_period_end').eq('id', first.subscriptionId).single();
    const second = await activatePayment((await createPendingPayment(u, 'plus', 'quarter')).id, rid(), 'card', 'verify');
    expect(second.subscriptionId).toBe(first.subscriptionId);
    const { data: s2 } = await admin().from('subscriptions').select('current_period_end').eq('id', first.subscriptionId).single();
    const months = (new Date(s2!.current_period_end!).getTime() - new Date(s1!.current_period_end!).getTime()) / 86_400_000;
    expect(months).toBeGreaterThan(88);
    expect(months).toBeLessThan(93);

    const up = await activatePayment((await createPendingPayment(u, 'premium', 'month')).id, rid(), 'card', 'verify');
    expect(up.subscriptionId).not.toBe(first.subscriptionId);
    const { data: old } = await admin().from('subscriptions').select('status').eq('id', first.subscriptionId).single();
    expect(old!.status).toBe('cancelled');
    expect((await getPlanState(u.userId)).code).toBe('premium');
  });

  it('blocks checkout of a lower plan while a higher plan is active', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy'; process.env.RAZORPAY_KEY_SECRET = 'test_secret_value'; resetRazorpayClient();
    const u = await newUser('downgrade');
    await activatePayment((await createPendingPayment(u, 'premium', 'month')).id, rid(), 'card', 'verify');
    const r = await call(checkoutPOST, request('/x', { token: u.token, body: { planCode: 'plus', interval: 'month' } }));
    expect(r.status).toBe(409);
    expect(rzpMock.orders.create).not.toHaveBeenCalled();
  });
});

describe('checkout + verify with (mocked) Razorpay', () => {
  beforeAll(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy'; process.env.RAZORPAY_KEY_SECRET = 'test_secret_value'; resetRazorpayClient();
  });

  it('creates an order with GST split, then verifies the signature and activates', async () => {
    const u = await newUser('verify');
    rzpMock.orders.create.mockImplementationOnce(async (b: { amount: number; receipt: string }) => ({ id: `order_${b.receipt.slice(0, 8)}`, amount: b.amount }));
    const co = await call<CheckoutOrder>(checkoutPOST, request('/x', { token: u.token, body: { planCode: 'premium', interval: 'quarter', billingState: 'TN', gstin: '33ABCDE1234F1Z5' } }));
    expect(co.status).toBe(200);
    const order = co.body.data!;
    expect(order.razorpayKeyId).toBe('rzp_test_dummy');
    const { data: pay } = await admin().from('payments').select('*').eq('id', order.paymentId).single();
    expect(pay!.igst_paise).toBe(pay!.gst_paise); // TN buyer, KA seller => IGST
    expect(pay!.cgst_paise).toBe(0);
    expect(pay!.razorpay_order_id).toBe(order.razorpayOrderId);

    const paymentId = rid();
    const bad = await call(verifyPOST, request('/x', { token: u.token, body: { razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: 'f'.repeat(64) } }));
    expect(bad.status).toBe(422);

    rzpMock.payments.fetch.mockResolvedValue({ id: paymentId, order_id: order.razorpayOrderId, amount: order.amountPaise, status: 'captured', method: 'upi' });
    const sig = hmacSha256Hex('test_secret_value', `${order.razorpayOrderId}|${paymentId}`);
    const ok = await call<{ already: boolean; invoiceId: string }>(verifyPOST, request('/x', { token: u.token, body: { razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: sig } }));
    expect(ok.status).toBe(200);
    expect(ok.body.data!.already).toBe(false);
    const again = await call<{ already: boolean }>(verifyPOST, request('/x', { token: u.token, body: { razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: sig } }));
    expect(again.body.data!.already).toBe(true);

    const hist = await call<BillingHistoryResponse>(historyGET, request('/x', { token: u.token }));
    expect(hist.body.data!.plan.code).toBe('premium');
    expect(hist.body.data!.payments[0]!.invoiceId).toBe(ok.body.data!.invoiceId);

    // Invoice: owner can read (JSON + HTML); another member cannot.
    const inv = await call<{ customer_gstin: string; igst_paise: number }>(invoiceHandler, request('/x', { token: u.token }), { id: ok.body.data!.invoiceId });
    expect(inv.status).toBe(200);
    expect(inv.body.data!.customer_gstin).toBe('33ABCDE1234F1Z5');
    const html = await invoiceGET(request(`/x?format=html`, { token: u.token }), { params: Promise.resolve({ id: ok.body.data!.invoiceId }) });
    const text = await html.text();
    expect(html.headers.get('content-type')).toContain('text/html');
    expect(text).toContain('Tax invoice');
    expect(text).toContain('IGST');
    expect(text).toMatch(/Rupees .* Only/);
    const other = await newUser('snoop');
    const denied = await call(invoiceHandler, request('/x', { token: other.token }), { id: ok.body.data!.invoiceId });
    expect(denied.status).toBe(404);
  });

  it('refuses to verify someone else\'s order', async () => {
    const owner = await newUser('owner');
    const thief = await newUser('thief');
    const pay = await createPendingPayment(owner, 'plus', 'month');
    const sig = hmacSha256Hex('test_secret_value', `${pay.razorpay_order_id}|pay_x`);
    const r = await call(verifyPOST, request('/x', { token: thief.token, body: { razorpayOrderId: pay.razorpay_order_id, razorpayPaymentId: 'pay_x', razorpaySignature: sig } }));
    expect(r.status).toBe(404);
  });

  it('processes a full refund and cancels the subscription', async () => {
    const u = await newUser('refund');
    const pay = await createPendingPayment(u, 'plus', 'month');
    const refundPayId = rid();
    const act = await activatePayment(pay.id, refundPayId, 'card', 'verify');
    const { data: refund } = await admin().from('refunds').insert({ payment_id: pay.id, amount_paise: pay.amount_paise, reason: 'Customer request', status: 'approved' }).select('id').single();
    rzpMock.payments.refund.mockResolvedValueOnce({ id: `rfnd_${randomUUID().slice(0, 8)}`, status: 'processed' });
    const adminUser = await newUser('refund-admin');
    const auth = (await getAuthContext(request('/x', { token: adminUser.token })))!;
    await processRefund(refund!.id, auth);
    expect(rzpMock.payments.refund).toHaveBeenCalledWith(refundPayId, expect.objectContaining({ amount: pay.amount_paise }));
    const { data: r } = await admin().from('refunds').select('status').eq('id', refund!.id).single();
    const { data: p } = await admin().from('payments').select('status, refunded_paise').eq('id', pay.id).single();
    const { data: s } = await admin().from('subscriptions').select('status').eq('id', act.subscriptionId).single();
    expect(r!.status).toBe('processed');
    expect(p).toEqual({ status: 'refunded', refunded_paise: pay.amount_paise });
    expect(s!.status).toBe('cancelled');
    await expect(processRefund(refund!.id, auth)).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('Razorpay webhook', () => {
  const secret = 'whsec_test_value';
  beforeAll(() => { process.env.RAZORPAY_WEBHOOK_SECRET = secret; });
  const send = (body: object, opts: { sig?: string; id?: string } = {}) => {
    const raw = JSON.stringify(body);
    return webhookPOST(new (require('next/server').NextRequest)(new URL('http://localhost/api/v1/webhooks/razorpay'), {
      method: 'POST', body: raw,
      headers: { 'x-razorpay-signature': opts.sig ?? hmacSha256Hex(secret, raw), 'x-razorpay-event-id': opts.id ?? `evt_${randomUUID()}`, 'content-type': 'application/json' },
    }));
  };

  it('rejects bad signatures', async () => {
    const r = await send({ event: 'payment.captured', payload: {} }, { sig: 'deadbeef' });
    expect(r.status).toBe(401);
  });

  it('activates on payment.captured exactly once across duplicate deliveries', async () => {
    const u = await newUser('webhook');
    const pay = await createPendingPayment(u, 'plus', 'month');
    const whId = rid();
    const evt = { event: 'payment.captured', created_at: 1, payload: { payment: { entity: { id: whId, order_id: pay.razorpay_order_id, amount: pay.amount_paise, status: 'captured', method: 'netbanking' } } } };
    const id = `evt_${randomUUID()}`;
    expect((await send(evt, { id })).status).toBe(200);
    const dup = await send(evt, { id });
    expect(dup.status).toBe(200);
    expect(await dup.json()).toMatchObject({ duplicate: true });
    const { data: p } = await admin().from('payments').select('status, method, razorpay_payment_id').eq('id', pay.id).single();
    expect(p).toEqual({ status: 'captured', method: 'netbanking', razorpay_payment_id: whId });
    const { count } = await admin().from('invoices').select('id', { count: 'exact', head: true }).eq('payment_id', pay.id);
    expect(count).toBe(1);
  });

  it('marks failed payments and ignores amount mismatches', async () => {
    const u = await newUser('whfail');
    const pay = await createPendingPayment(u, 'plus', 'month');
    expect((await send({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f', order_id: pay.razorpay_order_id, error_description: 'Card declined' } } } })).status).toBe(200);
    const { data: p } = await admin().from('payments').select('status, failure_reason').eq('id', pay.id).single();
    expect(p).toEqual({ status: 'failed', failure_reason: 'Card declined' });

    const pay2 = await createPendingPayment(u, 'plus', 'month');
    const mismatch = await send({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_m', order_id: pay2.razorpay_order_id, amount: 1, status: 'captured' } } } });
    expect(mismatch.status).toBe(500);
    const { data: p2 } = await admin().from('payments').select('status').eq('id', pay2.id).single();
    expect(p2!.status).toBe('created');
  });
});
