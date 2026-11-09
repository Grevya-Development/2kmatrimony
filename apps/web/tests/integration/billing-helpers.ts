import { randomUUID } from 'node:crypto';
import { admin, createTestUser, type TestUser } from './helpers';

/** Billing test helpers: create pending payments directly and clean up restricted FKs. */
export async function priceFor(planCode: string, interval: string) {
  const { data } = await admin().from('plans').select('id, plan_prices(id, interval, amount_paise)').eq('code', planCode).single();
  const price = data!.plan_prices.find((p) => p.interval === interval)!;
  return { planId: data!.id, priceId: price.id, amount: price.amount_paise };
}

export async function createPendingPayment(user: TestUser, planCode: string, interval: string, extra: Record<string, unknown> = {}) {
  const p = await priceFor(planCode, interval);
  const taxable = Math.round(p.amount / 1.18);
  const { data, error } = await admin().from('payments').insert({
    user_id: user.userId, plan_id: p.planId, price_id: p.priceId, interval,
    list_amount_paise: p.amount, amount_paise: p.amount, taxable_paise: taxable, gst_paise: p.amount - taxable,
    cgst_paise: Math.floor((p.amount - taxable) / 2), sgst_paise: p.amount - taxable - Math.floor((p.amount - taxable) / 2),
    status: 'created', razorpay_order_id: `order_test_${randomUUID().slice(0, 12)}`, billing_name: 'Test Member', billing_state: 'KA', ...extra,
  }).select('*').single();
  if (error) throw error;
  return data!;
}

export async function billingUser(label: string) {
  return createTestUser(label);
}

export async function cleanupBillingUsers(users: TestUser[]) {
  const a = admin();
  const ids = users.map((u) => u.userId);
  if (ids.length === 0) return;
  const { data: pays } = await a.from('payments').select('id').in('user_id', ids);
  const payIds = (pays ?? []).map((p) => p.id);
  if (payIds.length) {
    await a.from('invoices').delete().in('payment_id', payIds);
    await a.from('refunds').delete().in('payment_id', payIds);
    await a.from('coupon_redemptions').delete().in('payment_id', payIds);
    await a.from('payments').delete().in('id', payIds);
  }
  await a.from('subscriptions').delete().in('user_id', ids);
  for (const id of ids) await a.auth.admin.deleteUser(id);
}
