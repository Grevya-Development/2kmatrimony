import 'server-only';
import { formatInr } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { errors } from '@/server/http';
import { notify } from '@/server/notify';
import { razorpay } from './razorpay';

/**
 * Process an approved (or requested, when an authorised admin acts directly)
 * refund through Razorpay. Updates refund + payment status; a full refund of a
 * subscription's payment cancels that subscription. Audited.
 */
export async function processRefund(refundId: string, auth: AuthContext): Promise<void> {
  const client = db();
  const { data: refund } = await client.from('refunds').select('*').eq('id', refundId).maybeSingle();
  if (!refund) throw errors.notFound('Refund not found.');
  if (!['approved', 'requested'].includes(refund.status)) throw errors.conflict(`Refund is already ${refund.status}.`);
  const { data: pay } = await client.from('payments').select('*').eq('id', refund.payment_id).single();
  if (!pay || !pay.razorpay_payment_id || !['captured', 'partially_refunded'].includes(pay.status)) {
    throw errors.conflict('Only captured payments can be refunded.');
  }
  if (pay.refunded_paise + refund.amount_paise > pay.amount_paise) throw errors.validation('Refund exceeds the amount paid.');

  const rzp = razorpay();
  // Claim the refund (prevents double processing by concurrent admins).
  const { data: claimed } = await client.from('refunds').update({ status: 'processing', approved_by: refund.approved_by ?? auth.userId }).eq('id', refundId).in('status', ['approved', 'requested']).select('id').maybeSingle();
  if (!claimed) throw errors.conflict('This refund is already being processed.');

  try {
    const r = await rzp.payments.refund(pay.razorpay_payment_id, { amount: refund.amount_paise, notes: { refund_id: refundId, reason: refund.reason.slice(0, 200) } });
    const processed = r.status === 'processed';
    await client.from('refunds').update({ status: processed ? 'processed' : 'processing', razorpay_refund_id: r.id }).eq('id', refundId);
    if (processed) await applyProcessedRefund(refundId);
    await audit(auth, { action: 'billing.refund.process', entityType: 'refund', entityId: refundId, after: { razorpayRefundId: r.id, status: r.status, amount: refund.amount_paise } });
  } catch (err) {
    await client.from('refunds').update({ status: 'failed', notes: err instanceof Error ? err.message.slice(0, 300) : 'refund failed' }).eq('id', refundId);
    await audit(auth, { action: 'billing.refund.failed', entityType: 'refund', entityId: refundId, metadata: { error: err instanceof Error ? err.message : String(err) } });
    if (err && typeof err === 'object' && 'status' in err) throw err;
    throw errors.conflict('Razorpay could not process this refund. Check the payment in the Razorpay dashboard.');
  }
}

/** Apply a processed refund to payment + subscription (idempotent per refund). */
export async function applyProcessedRefund(refundId: string): Promise<void> {
  const client = db();
  const { data: refund } = await client.from('refunds').select('*').eq('id', refundId).single();
  if (!refund) return;
  const { data: pay } = await client.from('payments').select('*').eq('id', refund.payment_id).single();
  if (!pay) return;
  // Sum of processed refunds is the source of truth (safe to re-run).
  const { data: all } = await client.from('refunds').select('amount_paise').eq('payment_id', pay.id).eq('status', 'processed');
  const refunded = (all ?? []).reduce((s, x) => s + x.amount_paise, 0);
  const full = refunded >= pay.amount_paise;
  if (refunded === pay.refunded_paise && (full ? pay.status === 'refunded' : true)) return;
  await client.from('payments').update({ refunded_paise: refunded, status: full ? 'refunded' : 'partially_refunded' }).eq('id', pay.id);
  if (full && pay.subscription_id) {
    await client.from('subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', pay.subscription_id).eq('status', 'active');
  }
  await notify({ userId: pay.user_id, category: 'billing', templateKey: 'refund_processed', vars: { amount: formatInr(refund.amount_paise) }, data: { href: '/app/billing' } });
}
