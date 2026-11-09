import 'server-only';
import { track } from '@/server/analytics/track';
import { db } from '@/lib/supabase/admin';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';
import { publicEnv } from '@/lib/env';

export interface ActivationResult {
  already: boolean;
  subscriptionId: string;
  invoiceId: string | null;
  invoiceNumber?: string;
  periodEnd?: string;
  planName?: string;
}

/**
 * Shared activation path for Checkout verification and the payment.captured
 * webhook. The DB function is atomic and idempotent (row lock + re-check), so
 * concurrent verify/webhook calls produce exactly one subscription and invoice.
 */
export async function activatePayment(paymentId: string, razorpayPaymentId: string | null, method: string | null, source: 'verify' | 'webhook'): Promise<ActivationResult> {
  const { data, error } = await db().rpc('billing_activate_payment', {
    p_payment_id: paymentId,
    p_razorpay_payment_id: razorpayPaymentId as string,
    p_method: method as string,
    p_paid_at: new Date().toISOString(),
  });
  if (error) throw error;
  const r = data as { already: boolean; subscription_id: string; invoice_id: string | null; invoice_number?: string; period_end?: string; plan_name?: string };
  const result: ActivationResult = { already: r.already, subscriptionId: r.subscription_id, invoiceId: r.invoice_id, invoiceNumber: r.invoice_number, periodEnd: r.period_end, planName: r.plan_name };

  if (!r.already) {
    const { data: pay } = await db().from('payments').select('user_id, amount_paise').eq('id', paymentId).single();
    if (pay) {
      await notify({
        userId: pay.user_id,
        category: 'billing',
        templateKey: 'subscription_activated',
        vars: {
          plan: r.plan_name,
          until: r.period_end ? new Date(r.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
          invoiceNumber: r.invoice_number,
        },
        data: { href: '/app/billing', invoiceId: r.invoice_id },
        forceChannels: ['email'],
      });
      void track(pay.user_id, 'subscription_activated', { plan: r.plan_name ?? null, source, amount_inr: Math.round(pay.amount_paise / 100) });
      await audit(null, { action: 'billing.payment.captured', entityType: 'payment', entityId: paymentId, after: { subscriptionId: r.subscription_id, invoiceId: r.invoice_id, source, amount: pay.amount_paise } }, 'system');
    }
  }
  return result;
}

/** Mark a payment failed (no-op once captured). */
export async function failPayment(paymentId: string, reason: string, notifyUser: boolean): Promise<void> {
  const { data } = await db()
    .from('payments')
    .update({ status: 'failed', failure_reason: reason.slice(0, 300) })
    .eq('id', paymentId)
    .in('status', ['created', 'authorized'])
    .select('user_id')
    .maybeSingle();
  if (data && notifyUser) {
    await notify({ userId: data.user_id, category: 'billing', templateKey: 'payment_failed', data: { href: `${publicEnv.appUrl}/app/billing` } });
  }
}
