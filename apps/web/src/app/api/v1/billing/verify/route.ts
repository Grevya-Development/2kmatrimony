import { verifyPaymentSchema } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import { errors, parseJson, route } from '@/server/http';
import { activatePayment } from '@/server/billing/activation';
import { razorpay } from '@/server/billing/razorpay';
import { verifyPaymentSignature } from '@/server/billing/signatures';

/** Called by the client after Razorpay Checkout succeeds. Idempotent. */
export const POST = route({ rateLimit: { name: 'verify', limit: 20, windowSec: 600 } }, async ({ req, auth }) => {
  const input = await parseJson(req, verifyPaymentSchema);
  const rzp = razorpay();
  if (!verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature, serverEnv.razorpayKeySecret)) {
    throw errors.validation('Payment signature could not be verified.');
  }
  const { data: pay } = await db().from('payments').select('id, user_id, amount_paise, status').eq('razorpay_order_id', input.razorpayOrderId).maybeSingle();
  if (!pay || pay.user_id !== auth.userId) throw errors.notFound('Payment not found.');

  // Confirm with Razorpay that the money was actually captured for this order and amount.
  const remote = await rzp.payments.fetch(input.razorpayPaymentId);
  if (remote.order_id !== input.razorpayOrderId || Number(remote.amount) !== pay.amount_paise) throw errors.validation('Payment details do not match this order.');
  if (remote.status !== 'captured' && remote.status !== 'authorized') throw errors.conflict(`Payment is ${remote.status}. If money was deducted, it will be refunded automatically.`);

  const result = await activatePayment(pay.id, input.razorpayPaymentId, remote.method ?? null, 'verify');
  return { ...result, status: 'active' };
});
