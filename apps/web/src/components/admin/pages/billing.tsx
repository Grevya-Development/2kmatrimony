'use client';
import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Badge, Button, Dialog, DialogContent, Field, Input, NativeSelect, Notice, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { AdminHeader, ConfirmAction, DataTable, Drawer, ErrorOr, FilterSelect, KeyValues, Pager, Panel, StatusBadge, fmtDate, fmtDateTime, fmtInr, human, mutate, qs, useAdminData, useCan, type Paged } from '../kit';

interface Sub { id: string; user_id: string; status: string; current_period_start: string | null; current_period_end: string | null; granted_by_admin: string | null; razorpay_subscription_id: string | null; created_at: string; plan: { code: string; name: string } | null; member: string | null }
interface Pay { id: string; user_id: string; status: string; amount_paise: number; discount_paise: number; gst_paise: number; method: string | null; razorpay_payment_id: string | null; paid_at: string | null; created_at: string; plan: { name: string } | null; member: string | null }
interface Refund { id: string; payment_id: string; amount_paise: number; reason: string; status: string; razorpay_refund_id: string | null; notes: string | null; created_at: string }
interface Coupon { id: string; code: string; description: string | null; discount_type: string; discount_value: number; max_redemptions: number | null; per_user_limit: number; redeemed_count: number; plan_codes: string[]; valid_from: string; valid_until: string | null; is_active: boolean }

export function SubscriptionsPage() {
  const [f, setF] = React.useState({ status: 'active', plan: '', page: 1 });
  const state = useAdminData<Paged<Sub>>(`/admin/subscriptions${qs(f)}`);
  return (
    <>
      <AdminHeader title="Subscriptions" description="Paid and admin-granted plans. Manage an individual member’s plan from their user page." />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterSelect label="Status" value={f.status} onChange={(status) => setF({ ...f, status, page: 1 })} options={[['', 'All statuses'], ['active', 'Active'], ['created', 'Created'], ['past_due', 'Past due'], ['cancelled', 'Cancelled'], ['expired', 'Expired'], ['halted', 'Halted']]} />
          <FilterSelect label="Plan" value={f.plan} onChange={(plan) => setF({ ...f, plan, page: 1 })} options={[['', 'All plans'], ['plus', 'Plus'], ['premium', 'Premium'], ['elite', 'Elite']]} />
        </div>
        <ErrorOr state={state}>
          {(d) => (
            <>
              <DataTable<Sub> caption="Subscriptions" rows={d.items}
                columns={[
                  { key: 'member', label: 'Member', render: (s) => <Link className="text-burgundy-600 hover:underline" href={`/admin/users/${s.user_id}`}>{s.member ?? 'Member'}</Link> },
                  { key: 'plan', label: 'Plan', render: (s) => s.plan?.name ?? '—' },
                  { key: 'status', label: 'Status', render: (s) => <span className="inline-flex gap-1"><StatusBadge status={s.status} />{s.granted_by_admin && <Badge tone="info">Granted</Badge>}</span> },
                  { key: 'period', label: 'Period', render: (s) => `${fmtDate(s.current_period_start)} – ${fmtDate(s.current_period_end)}` },
                  { key: 'created', label: 'Created', render: (s) => fmtDate(s.created_at), hideOnMobile: true },
                ]} />
              <Pager page={d.page} pages={d.pages} total={d.total} onPage={(page) => setF({ ...f, page })} />
            </>
          )}
        </ErrorOr>
      </Panel>
    </>
  );
}

export function PaymentsPage() {
  const can = useCan();
  return (
    <>
      <AdminHeader title="Payments" description="Razorpay payments, GST invoices, refunds and coupons. Amounts are GST-inclusive." />
      <Tabs defaultValue="payments">
        <TabsList><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="refunds">Refunds</TabsTrigger><TabsTrigger value="coupons">Coupons</TabsTrigger></TabsList>
        <TabsContent value="payments"><PaymentsTab /></TabsContent>
        <TabsContent value="refunds"><RefundsTab canManage={can('refunds.manage')} /></TabsContent>
        <TabsContent value="coupons"><CouponsTab canManage={can('coupons.manage')} /></TabsContent>
      </Tabs>
    </>
  );
}

function PaymentsTab() {
  const [f, setF] = React.useState({ status: '', from: '', to: '', page: 1 });
  const state = useAdminData<Paged<Pay>>(`/admin/payments${qs(f)}`);
  const [openId, setOpenId] = React.useState<string | null>(null);
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterSelect label="Status" value={f.status} onChange={(status) => setF({ ...f, status, page: 1 })} options={[['', 'All statuses'], ['captured', 'Captured'], ['created', 'Created'], ['failed', 'Failed'], ['refunded', 'Refunded'], ['partially_refunded', 'Partially refunded']]} />
        <Input type="date" aria-label="From" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, page: 1 })} className="h-10 w-auto text-sm" />
        <Input type="date" aria-label="To" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value, page: 1 })} className="h-10 w-auto text-sm" />
      </div>
      <ErrorOr state={state}>
        {(d) => (
          <>
            <DataTable<Pay> caption="Payments" rows={d.items} onRowClick={(p) => setOpenId(p.id)}
              columns={[
                { key: 'member', label: 'Member', render: (p) => p.member ?? 'Member' },
                { key: 'plan', label: 'Plan', render: (p) => p.plan?.name ?? '—' },
                { key: 'amount', label: 'Amount', render: (p) => <span className="text-ink">{fmtInr(p.amount_paise)}</span> },
                { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
                { key: 'method', label: 'Method', render: (p) => human(p.method), hideOnMobile: true },
                { key: 'date', label: 'Date', render: (p) => fmtDateTime(p.paid_at ?? p.created_at) },
              ]} />
            <Pager page={d.page} pages={d.pages} total={d.total} onPage={(page) => setF({ ...f, page })} />
          </>
        )}
      </ErrorOr>
      <Drawer open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} title="Payment">
        {openId && <PaymentDetail id={openId} onChanged={state.reload} />}
      </Drawer>
    </Panel>
  );
}

interface PaymentDetailData {
  payment: Record<string, unknown> & { id: string; amount_paise: number; status: string; user_id: string; razorpay_order_id: string | null; razorpay_payment_id: string | null; discount_paise: number; gst_paise: number; taxable_paise: number; paid_at: string | null; plans: { name: string } | null; coupons: { code: string } | null };
  invoice: { id: string; invoice_number: string; billing_name: string; billing_state: string | null; customer_gstin: string | null; cgst_paise: number; sgst_paise: number; igst_paise: number; total_paise: number; issued_at: string } | null;
  refunds: Refund[];
  member: { id: string; full_name: string | null } | null;
}

function PaymentDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const state = useAdminData<PaymentDetailData>(`/admin/payments/${id}`);
  const can = useCan();
  const [amount, setAmount] = React.useState('');
  return (
    <ErrorOr state={state}>
      {(d) => {
        const p = d.payment;
        const committed = d.refunds.filter((r) => !['rejected', 'failed'].includes(r.status)).reduce((s, r) => s + r.amount_paise, 0);
        const refundable = p.amount_paise - committed;
        return (
          <div className="space-y-5">
            <KeyValues items={[
              ['Member', d.member ? <Link key="m" className="text-burgundy-600 hover:underline" href={`/admin/users/${d.member.id}`}>{d.member.full_name ?? 'Member'}</Link> : '—'],
              ['Plan', p.plans?.name], ['Status', <StatusBadge key="s" status={p.status} />], ['Paid', fmtDateTime(p.paid_at)],
              ['Amount', fmtInr(p.amount_paise)], ['Discount', fmtInr(p.discount_paise)], ['Taxable value', fmtInr(p.taxable_paise)], ['GST', fmtInr(p.gst_paise)],
              ['Coupon', p.coupons?.code], ['Razorpay order', <span key="o" className="font-mono text-xs">{p.razorpay_order_id ?? '—'}</span>], ['Razorpay payment', <span key="p" className="font-mono text-xs">{p.razorpay_payment_id ?? '—'}</span>],
            ]} />
            {d.invoice ? (
              <div className="rounded-xl border border-line p-4">
                <h3 className="text-sm font-semibold">Invoice {d.invoice.invoice_number}</h3>
                <KeyValues items={[['Billed to', d.invoice.billing_name], ['Place of supply', d.invoice.billing_state], ['GSTIN', d.invoice.customer_gstin], ['Issued', fmtDate(d.invoice.issued_at)], ['CGST / SGST', `${fmtInr(d.invoice.cgst_paise)} / ${fmtInr(d.invoice.sgst_paise)}`], ['IGST', fmtInr(d.invoice.igst_paise)], ['Total', fmtInr(d.invoice.total_paise)]]} />
                <a className="mt-3 inline-block text-sm text-burgundy-600 hover:underline" href={`/api/v1/billing/invoices/${d.invoice.id}?format=html`} target="_blank" rel="noreferrer">Open printable invoice</a>
              </div>
            ) : <p className="text-sm text-muted">No invoice issued for this payment.</p>}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Refunds</h3>
              {d.refunds.length ? <ul className="space-y-1 text-sm">{d.refunds.map((r) => <li key={r.id} className="flex justify-between"><span>{fmtInr(r.amount_paise)} — {r.reason}</span><StatusBadge status={r.status} /></li>)}</ul> : <p className="text-sm text-muted">None.</p>}
            </div>
            {can('refunds.manage') && ['captured', 'partially_refunded'].includes(p.status) && refundable > 0 && (
              <ConfirmAction
                trigger={<Button variant="secondary">Request refund</Button>}
                title="Request a refund" description={`Up to ${fmtInr(refundable)} can be refunded. A finance admin approves it before it is processed through Razorpay.`}
                confirmLabel="Create request" requireReason
                extra={<Field label="Amount (₹)" htmlFor="refund-amount" hint={`Max ${(refundable / 100).toFixed(2)}`}><Input type="number" step="0.01" min="1" max={refundable / 100} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>}
                onConfirm={(reason) => mutate('/admin/refunds', 'POST', { paymentId: p.id, amountPaise: Math.round(Number(amount) * 100), reason }, 'Refund requested').then((r) => { if (r) { state.reload(); onChanged(); } return r; })}
              />
            )}
          </div>
        );
      }}
    </ErrorOr>
  );
}

function RefundsTab({ canManage }: { canManage: boolean }) {
  const [f, setF] = React.useState({ status: 'requested', page: 1 });
  const state = useAdminData<Paged<Refund>>(`/admin/refunds${qs(f)}`);
  const [notice, setNotice] = React.useState<string | null>(null);
  return (
    <Panel>
      <div className="mb-4"><FilterSelect label="Status" value={f.status} onChange={(status) => setF({ status, page: 1 })} options={[['', 'All'], ['requested', 'Requested'], ['approved', 'Approved'], ['processing', 'Processing'], ['processed', 'Processed'], ['rejected', 'Rejected'], ['failed', 'Failed']]} /></div>
      {notice && <Notice tone="warning" className="mb-4">{notice}</Notice>}
      <ErrorOr state={state}>
        {(d) => (
          <>
            <DataTable<Refund> caption="Refunds" rows={d.items} empty="No refunds in this view."
              columns={[
                { key: 'amount', label: 'Amount', render: (r) => <span className="text-ink">{fmtInr(r.amount_paise)}</span> },
                { key: 'reason', label: 'Reason', render: (r) => <span className="line-clamp-2">{r.reason}</span> },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'rzp', label: 'Razorpay refund', render: (r) => <span className="font-mono text-xs">{r.razorpay_refund_id ?? '—'}</span>, hideOnMobile: true },
                { key: 'created', label: 'Requested', render: (r) => fmtDateTime(r.created_at), hideOnMobile: true },
                { key: 'act', label: '', render: (r) => canManage && ['requested', 'approved', 'failed'].includes(r.status) ? (
                  <div className="flex gap-1">
                    <ConfirmAction trigger={<Button size="sm">{r.status === 'requested' ? 'Approve' : 'Retry'}</Button>} title={`Refund ${fmtInr(r.amount_paise)}?`} description="Money is returned to the original payment method via Razorpay." confirmLabel="Approve & process"
                      onConfirm={() => mutate<{ processing: { ok: boolean; message: string | null } }>(`/admin/refunds/${r.id}/approve`, 'POST', undefined).then((res) => {
                        if (res) { setNotice(res.processing.ok ? null : `Approved, but processing is unavailable: ${res.processing.message}`); state.reload(); }
                        return res;
                      })} />
                    {r.status !== 'failed' && <ConfirmAction trigger={<Button size="sm" variant="ghost">Reject</Button>} title="Reject refund" confirmLabel="Reject" requireReason danger
                      onConfirm={(reason) => mutate(`/admin/refunds/${r.id}/reject`, 'POST', { reason }, 'Refund rejected').then((res) => { if (res) state.reload(); return res; })} />}
                  </div>
                ) : null },
              ]} />
            <Pager page={d.page} pages={d.pages} total={d.total} onPage={(page) => setF({ ...f, page })} />
          </>
        )}
      </ErrorOr>
    </Panel>
  );
}

const emptyCoupon = { code: '', description: '', discountType: 'percent', discountValue: 10, maxRedemptions: '', perUserLimit: 1, planCodes: [] as string[], validUntil: '', isActive: true };

function CouponsTab({ canManage }: { canManage: boolean }) {
  const state = useAdminData<Coupon[]>('/admin/coupons');
  const [editing, setEditing] = React.useState<(typeof emptyCoupon & { id?: string }) | null>(null);
  return (
    <Panel actions={canManage ? <Button size="sm" onClick={() => setEditing({ ...emptyCoupon })}><Plus />New coupon</Button> : undefined}>
      <ErrorOr state={state}>
        {(rows) => (
          <DataTable<Coupon> caption="Coupons" rows={rows} empty="No coupons yet."
            onRowClick={canManage ? (c) => setEditing({ id: c.id, code: c.code, description: c.description ?? '', discountType: c.discount_type, discountValue: c.discount_value, maxRedemptions: c.max_redemptions === null ? '' : String(c.max_redemptions), perUserLimit: c.per_user_limit, planCodes: c.plan_codes, validUntil: c.valid_until ? c.valid_until.slice(0, 10) : '', isActive: c.is_active }) : undefined}
            columns={[
              { key: 'code', label: 'Code', render: (c) => <span className="font-mono text-ink">{c.code}</span> },
              { key: 'discount', label: 'Discount', render: (c) => (c.discount_type === 'percent' ? `${c.discount_value}%` : fmtInr(c.discount_value)) },
              { key: 'plans', label: 'Plans', render: (c) => (c.plan_codes.length ? c.plan_codes.join(', ') : 'All'), hideOnMobile: true },
              { key: 'used', label: 'Redeemed', render: (c) => `${c.redeemed_count}${c.max_redemptions ? ` / ${c.max_redemptions}` : ''}` },
              { key: 'until', label: 'Valid until', render: (c) => fmtDate(c.valid_until), hideOnMobile: true },
              { key: 'active', label: 'Active', render: (c) => <Badge tone={c.is_active ? 'success' : 'outline'}>{c.is_active ? 'Active' : 'Inactive'}</Badge> },
            ]} />
        )}
      </ErrorOr>
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent title={editing.id ? `Edit ${editing.code}` : 'New coupon'}>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const body = {
                ...(editing.id ? {} : { code: editing.code }), description: editing.description || null, discountType: editing.discountType,
                discountValue: Number(editing.discountValue),
                maxRedemptions: editing.maxRedemptions === '' ? null : Number(editing.maxRedemptions), perUserLimit: Number(editing.perUserLimit), planCodes: editing.planCodes,
                validUntil: editing.validUntil ? new Date(`${editing.validUntil}T23:59:59+05:30`).toISOString() : null, isActive: editing.isActive,
              };
              const r = editing.id ? await mutate(`/admin/coupons/${editing.id}`, 'PATCH', body, 'Coupon saved') : await mutate('/admin/coupons', 'POST', body, 'Coupon created');
              if (r) { setEditing(null); state.reload(); }
            }}>
              {!editing.id && <Field label="Code" htmlFor="c-code"><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className="font-mono" required /></Field>}
              <Field label="Description" htmlFor="c-desc" optional><Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type" htmlFor="c-type"><NativeSelect value={editing.discountType} onChange={(e) => setEditing({ ...editing, discountType: e.target.value })}><option value="percent">Percent</option><option value="flat">Flat (paise)</option></NativeSelect></Field>
                <Field label={editing.discountType === 'percent' ? 'Percent off' : 'Amount off (paise)'} htmlFor="c-val"><Input type="number" min={1} value={editing.discountValue} onChange={(e) => setEditing({ ...editing, discountValue: Number(e.target.value) })} /></Field>
                <Field label="Max redemptions" htmlFor="c-max" optional><Input type="number" min={1} value={editing.maxRedemptions} onChange={(e) => setEditing({ ...editing, maxRedemptions: e.target.value })} /></Field>
                <Field label="Per member limit" htmlFor="c-per"><Input type="number" min={1} value={editing.perUserLimit} onChange={(e) => setEditing({ ...editing, perUserLimit: Number(e.target.value) })} /></Field>
                <Field label="Valid until" htmlFor="c-until" optional><Input type="date" value={editing.validUntil} onChange={(e) => setEditing({ ...editing, validUntil: e.target.value })} /></Field>
              </div>
              <fieldset><legend className="mb-2 text-sm font-medium text-ink-2">Plans (none = all)</legend>
                <div className="flex gap-4">{['plus', 'premium', 'elite'].map((p) => <label key={p} className="flex items-center gap-2 text-sm capitalize"><input type="checkbox" className="h-4 w-4 accent-burgundy-600" checked={editing.planCodes.includes(p)} onChange={(e) => setEditing({ ...editing, planCodes: e.target.checked ? [...editing.planCodes, p] : editing.planCodes.filter((x) => x !== p) })} />{p}</label>)}</div>
              </fieldset>
              <div className="flex items-center justify-between"><span className="text-sm text-ink-2">Active</span><Switch checked={editing.isActive} onCheckedChange={(isActive) => setEditing({ ...editing, isActive })} aria-label="Active" /></div>
              <div className="flex justify-between gap-2">
                {editing.id ? <Button type="button" variant="ghost" className="text-danger" onClick={async () => { if (await mutate(`/admin/coupons/${editing.id}`, 'DELETE', undefined, 'Coupon removed')) { setEditing(null); state.reload(); } }}>Delete</Button> : <span />}
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Panel>
  );
}
