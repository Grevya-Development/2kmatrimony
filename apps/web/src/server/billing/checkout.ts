import 'server-only';
import { displayName, type CheckoutInput, type CheckoutOrder } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import type { AuthContext } from '@/server/auth';
import { requireFlag } from '@/server/config';
import { getPlanState } from '@/server/entitlements';
import { errors } from '@/server/http';
import { audit } from '@/server/audit';
import { buildQuote } from './quote';
import { razorpay } from './razorpay';

/** Create a pending payment + Razorpay order for a plan purchase. */
export async function createCheckout(auth: AuthContext, input: CheckoutInput): Promise<CheckoutOrder> {
  await requireFlag('payments');
  const rzp = razorpay(); // 503 when unconfigured — checked before any DB writes

  const quote = await buildQuote({ userId: auth.userId, planCode: input.planCode, interval: input.interval, couponCode: input.couponCode, billingState: input.billingState });

  // No downgrades while a higher plan is active (switch after it ends).
  const current = await getPlanState(auth.userId);
  if (current.subscriptionId && current.code !== quote.price.planCode) {
    const { data: cur } = await db().from('plans').select('sort_order, name').eq('code', current.code).maybeSingle();
    if (cur && cur.sort_order > quote.price.sortOrder) {
      throw errors.conflict(`Your ${cur.name} plan is active until ${new Date(current.currentPeriodEnd!).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. You can choose ${quote.price.planName} after it ends.`);
    }
  }

  const billingName = auth.profile ? displayName(auth.profile.first_name, auth.profile.last_name, 'full', auth.user.full_name ?? 'Member') : auth.user.full_name ?? 'Member';
  const { data: payment, error } = await db()
    .from('payments')
    .insert({
      user_id: auth.userId,
      plan_id: quote.price.planId,
      price_id: quote.price.priceId,
      interval: quote.price.interval,
      coupon_id: quote.coupon?.couponId ?? null,
      list_amount_paise: quote.listPaise,
      discount_paise: quote.discountPaise,
      amount_paise: quote.gst.amountPaise,
      taxable_paise: quote.gst.taxablePaise,
      gst_paise: quote.gst.gstPaise,
      cgst_paise: quote.gst.cgstPaise,
      sgst_paise: quote.gst.sgstPaise,
      igst_paise: quote.gst.igstPaise,
      currency: quote.price.currency,
      status: 'created',
      billing_name: billingName,
      billing_email: auth.email,
      billing_phone: auth.phone,
      billing_state: input.billingState ?? null,
      customer_gstin: input.gstin ?? null,
    })
    .select('id')
    .single();
  if (error || !payment) throw error ?? new Error('Could not create payment');

  let orderId: string;
  try {
    const order = await rzp.orders.create({
      amount: quote.gst.amountPaise,
      currency: quote.price.currency,
      receipt: payment.id,
      notes: { payment_id: payment.id, user_id: auth.userId, plan: quote.price.planCode, interval: quote.price.interval },
    });
    orderId = order.id;
  } catch (err) {
    await db().from('payments').update({ status: 'failed', failure_reason: 'order_creation_failed' }).eq('id', payment.id);
    console.error('[billing] razorpay order failed', err);
    throw errors.conflict('We could not start the payment. Please try again in a moment.');
  }
  await db().from('payments').update({ razorpay_order_id: orderId }).eq('id', payment.id);
  await audit(auth, { action: 'billing.checkout.create', entityType: 'payment', entityId: payment.id, after: { plan: quote.price.planCode, interval: quote.price.interval, amount: quote.gst.amountPaise, coupon: quote.coupon?.code ?? null } });

  return {
    paymentId: payment.id,
    razorpayOrderId: orderId,
    razorpayKeyId: serverEnv.razorpayKeyId,
    amountPaise: quote.gst.amountPaise,
    currency: quote.price.currency,
    listAmountPaise: quote.listPaise,
    discountPaise: quote.discountPaise,
    gstPaise: quote.gst.gstPaise,
    planName: quote.price.planName,
    prefill: { name: billingName, email: auth.email, contact: auth.phone },
  };
}
