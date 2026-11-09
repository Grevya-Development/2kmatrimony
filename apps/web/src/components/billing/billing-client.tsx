'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import {
  BILLING_INTERVAL_LABELS, formatInr,
  type BillingHistoryResponse, type BillingInterval, type CheckoutOrder, type CouponPreview, type PlanItem,
} from '@2k/shared';
import { Badge, Button, Card, CardContent, Dialog, DialogContent, EmptyState, ErrorState, Field, Input, NativeSelect, Notice, PageHeader, Skeleton } from '@/components/ui';
import { PricingTable } from '@/components/marketing/pricing-table';
import { useMe } from '@/components/shell/me-context';
import { api, ApiClientError } from '@/lib/api';
import { INDIAN_STATES } from './states';
import { openCheckout } from './razorpay-checkout';

const dateFmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const STATUS_TONE: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = { captured: 'success', failed: 'danger', refunded: 'warning', partially_refunded: 'warning', authorized: 'neutral' };
const STATUS_LABEL: Record<string, string> = { captured: 'Paid', failed: 'Failed', refunded: 'Refunded', partially_refunded: 'Partly refunded', authorized: 'Processing' };

export function BillingClient({ brandName, paymentsEnabled }: { brandName: string; paymentsEnabled: boolean }) {
  const router = useRouter();
  const { refresh } = useMe();
  const [plans, setPlans] = React.useState<PlanItem[] | null>(null);
  const [history, setHistory] = React.useState<BillingHistoryResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<{ plan: PlanItem; interval: BillingInterval } | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [p, h] = await Promise.all([api<PlanItem[]>('/plans'), api<BillingHistoryResponse>('/billing/history')]);
      setPlans(p);
      setHistory(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load billing.');
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const onPaid = async () => {
    setSelected(null);
    await Promise.all([load(), refresh()]);
    router.refresh();
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!plans || !history) return <div className="space-y-6"><Skeleton className="h-32" /><Skeleton className="h-96" /></div>;

  const current = history.plan;
  return (
    <div className="space-y-12">
      <PageHeader eyebrow="Plans & billing" title="Your plan" description="Prices include GST. Plans do not renew automatically — you choose when to extend." />

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow mb-1">Current plan</p>
            <p className="font-serif text-3xl">{current.name}</p>
            <p className="mt-1 text-sm text-muted">{current.currentPeriodEnd ? `Active until ${dateFmt(current.currentPeriodEnd)}` : 'Free forever — upgrade any time.'}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-ink-2">
            <span>Interests / day</span><span className="font-medium text-ink">{current.entitlements.interests_per_day}</span>
            <span>Matches / day</span><span className="font-medium text-ink">{current.entitlements.daily_recommendations}</span>
            <span>AI insights</span><span className="font-medium capitalize text-ink">{current.entitlements.ai_insights}</span>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="plans-heading" className="space-y-6">
        <h2 id="plans-heading" className="font-serif text-3xl">Choose a plan</h2>
        {!paymentsEnabled && <Notice tone="warning">Online payments are not available right now. Your current plan is unaffected.</Notice>}
        <PricingTable plans={plans} currentCode={current.code} onChoose={paymentsEnabled ? (plan, interval) => setSelected({ plan, interval }) : undefined} ctaHref="/app/billing" />
      </section>

      <section aria-labelledby="history-heading" className="space-y-4">
        <h2 id="history-heading" className="font-serif text-3xl">Payment history</h2>
        {history.payments.length === 0 ? (
          <EmptyState icon={<Receipt />} title="No payments yet" description="Your payments and GST invoices will appear here." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line text-left text-muted"><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Plan</th><th className="px-5 py-3 font-medium">Amount</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium"><span className="sr-only">Invoice</span></th></tr></thead>
              <tbody>
                {history.payments.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3.5">{dateFmt(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-5 py-3.5">{p.planName ?? '—'}{p.interval ? <span className="text-muted"> · {BILLING_INTERVAL_LABELS[p.interval]}</span> : null}</td>
                    <td className="px-5 py-3.5">{formatInr(p.amountPaise)}{p.discountPaise > 0 && <span className="block text-xs text-muted">saved {formatInr(p.discountPaise)}</span>}{p.refundedPaise > 0 && <span className="block text-xs text-warning">refunded {formatInr(p.refundedPaise)}</span>}</td>
                    <td className="px-5 py-3.5"><Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{STATUS_LABEL[p.status] ?? p.status}</Badge></td>
                    <td className="px-5 py-3.5 text-right">{p.invoiceId && <a className="inline-flex items-center gap-1.5 text-emerald-600 hover:underline" href={`/api/v1/billing/invoices/${p.invoiceId}?format=html`} target="_blank" rel="noopener"><FileText className="h-4 w-4" />Invoice</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent title={`${selected.plan.name} · ${BILLING_INTERVAL_LABELS[selected.interval]}`} description="Review your order. You will complete payment securely with Razorpay.">
            <CheckoutForm plan={selected.plan} interval={selected.interval} brandName={brandName} onPaid={onPaid} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function CheckoutForm({ plan, interval, brandName, onPaid }: { plan: PlanItem; interval: BillingInterval; brandName: string; onPaid: () => Promise<void> }) {
  const price = plan.prices.find((p) => p.interval === interval)!;
  const [coupon, setCoupon] = React.useState('');
  const [preview, setPreview] = React.useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [billingState, setBillingState] = React.useState('');
  const [gstin, setGstin] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const applyCoupon = async () => {
    setCouponError(null);
    setPreview(null);
    if (!coupon.trim()) return;
    try {
      setPreview(await api<CouponPreview>('/billing/coupon-preview', { body: { planCode: plan.code, interval, couponCode: coupon.trim() } }));
    } catch (e) {
      setCouponError(e instanceof Error ? e.message : 'Coupon could not be applied.');
    }
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const order = await api<CheckoutOrder>('/billing/checkout', {
        body: { planCode: plan.code, interval, couponCode: preview ? coupon.trim() : undefined, billingState: billingState || undefined, gstin: gstin.trim().toUpperCase() || undefined },
      });
      const result = await openCheckout(order, brandName);
      if (!result) { setBusy(false); return; }
      await api('/billing/verify', { body: { razorpayOrderId: result.razorpay_order_id, razorpayPaymentId: result.razorpay_payment_id, razorpaySignature: result.razorpay_signature } });
      toast.success(`Your ${plan.name} plan is active. Your GST invoice is in Payment history.`);
      await onPaid();
    } catch (err) {
      setError(err instanceof ApiClientError && err.code === 'service_unconfigured' ? 'Online payments are not configured yet. Please try again later.' : err instanceof Error ? err.message : 'Payment failed.');
      setBusy(false);
    }
  };

  const total = preview?.amountPaise ?? price.amountPaise;
  return (
    <form onSubmit={pay} className="space-y-5">
      <dl className="space-y-2 rounded-2xl bg-surface-2 p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted">{plan.name} plan · {BILLING_INTERVAL_LABELS[interval]}</dt><dd>{formatInr(price.amountPaise)}</dd></div>
        {preview && <div className="flex justify-between text-success"><dt>Coupon {preview.code}</dt><dd>− {formatInr(preview.discountPaise)}</dd></div>}
        <div className="flex justify-between border-t border-line pt-2 font-medium"><dt>Total (incl. GST)</dt><dd>{formatInr(total)}</dd></div>
      </dl>
      <Field label="Coupon code" htmlFor="coupon" optional error={couponError}>
        <div className="flex gap-2">
          <Input id="coupon" value={coupon} onChange={(e) => { setCoupon(e.target.value); setPreview(null); }} autoCapitalize="characters" />
          <Button type="button" variant="secondary" onClick={applyCoupon} disabled={!coupon.trim()}>Apply</Button>
        </div>
      </Field>
      <Field label="State (place of supply)" htmlFor="state" optional hint="Used for your GST invoice.">
        <NativeSelect value={billingState} onChange={(e) => setBillingState(e.target.value)}>
          <option value="">Select your state</option>
          {INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </NativeSelect>
      </Field>
      <Field label="GSTIN" htmlFor="gstin" optional hint="Only if you need a business (B2B) invoice.">
        <Input value={gstin} onChange={(e) => setGstin(e.target.value)} maxLength={15} autoCapitalize="characters" />
      </Field>
      {error && <ErrorState message={error} />}
      <Button type="submit" size="lg" className="w-full" loading={busy}>Pay {formatInr(total)}</Button>
      <p className="text-center text-xs text-muted">Payments are processed by Razorpay. We never see or store your card or UPI details.</p>
    </form>
  );
}
