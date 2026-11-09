import 'server-only';
import { db } from '@/lib/supabase/admin';
import { getPlanState } from '@/server/entitlements';

export async function billingHistory(userId: string) {
  const c = db();
  const [plan, payments, invoices, refunds] = await Promise.all([
    getPlanState(userId),
    c.from('payments').select('id, status, amount_paise, list_amount_paise, discount_paise, gst_paise, currency, method, interval, paid_at, created_at, failure_reason, refunded_paise, plans(code, name)').eq('user_id', userId).neq('status', 'created').order('created_at', { ascending: false }).limit(100),
    c.from('invoices').select('id, invoice_number, payment_id, total_paise, issued_at').eq('user_id', userId).order('issued_at', { ascending: false }).limit(100),
    c.from('refunds').select('id, payment_id, amount_paise, status, created_at, payments!inner(user_id)').eq('payments.user_id', userId).order('created_at', { ascending: false }),
  ]);
  return {
    plan: { code: plan.code, name: plan.name, currentPeriodEnd: plan.currentPeriodEnd, subscriptionId: plan.subscriptionId, entitlements: plan.entitlements },
    payments: (payments.data ?? []).map((p) => ({
      id: p.id,
      status: p.status,
      amountPaise: p.amount_paise,
      listAmountPaise: p.list_amount_paise,
      discountPaise: p.discount_paise,
      gstPaise: p.gst_paise,
      refundedPaise: p.refunded_paise,
      currency: p.currency,
      method: p.method,
      interval: p.interval,
      planCode: (p.plans as { code: string } | null)?.code ?? null,
      planName: (p.plans as { name: string } | null)?.name ?? null,
      paidAt: p.paid_at,
      createdAt: p.created_at,
      failureReason: p.failure_reason,
      invoiceId: (invoices.data ?? []).find((i) => i.payment_id === p.id)?.id ?? null,
    })),
    invoices: (invoices.data ?? []).map((i) => ({ id: i.id, invoiceNumber: i.invoice_number, paymentId: i.payment_id, totalPaise: i.total_paise, issuedAt: i.issued_at })),
    refunds: (refunds.data ?? []).map((r) => ({ id: r.id, paymentId: r.payment_id, amountPaise: r.amount_paise, status: r.status, createdAt: r.created_at })),
  };
}
export type BillingHistory = Awaited<ReturnType<typeof billingHistory>>;
