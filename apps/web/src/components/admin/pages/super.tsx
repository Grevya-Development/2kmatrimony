'use client';
import * as React from 'react';
import { Plus } from 'lucide-react';
import { ADMIN_PERMISSIONS, BILLING_INTERVALS, BILLING_INTERVAL_LABELS } from '@2k/shared';
import { Badge, Button, Dialog, DialogContent, Field, Input, NativeSelect, Notice, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui';
import { AdminHeader, ConfirmAction, DataTable, ErrorOr, KeyValues, Panel, StatCard, StatusBadge, fmtDateTime, fmtInr, human, mutate, useAdminData } from '../kit';

interface AdminRow { user_id: string; display_name: string; is_active: boolean; mfa_required: boolean; last_login_at: string | null; created_at: string; role_id: string; role: { key: string; name: string }; email: string | null; phone: string | null }
interface Role { id: string; key: string; name: string; description: string | null; isSystem: boolean; permissions: string[]; memberCount: number }
interface Perm { key: string; description: string; category: string }

export function SuperAdminPage() {
  return (
    <>
      <AdminHeader title="Super admin" description="Accounts, permissions, pricing and the health of the platform. Every change here is audited." />
      <Tabs defaultValue="admins">
        <TabsList className="flex-wrap">
          <TabsTrigger value="admins">Admins</TabsTrigger><TabsTrigger value="roles">Roles & permissions</TabsTrigger>
          <TabsTrigger value="plans">Plans & pricing</TabsTrigger><TabsTrigger value="system">System & integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="admins"><Admins /></TabsContent>
        <TabsContent value="roles"><Roles /></TabsContent>
        <TabsContent value="plans"><Plans /></TabsContent>
        <TabsContent value="system"><SystemTab /></TabsContent>
      </Tabs>
    </>
  );
}

function Admins() {
  const state = useAdminData<AdminRow[]>('/admin/admins');
  const roles = useAdminData<{ roles: Role[] }>('/admin/roles');
  const [invite, setInvite] = React.useState<{ identifier: string; roleId: string; displayName: string; mfaRequired: boolean } | null>(null);
  const update = async (id: string, body: Record<string, unknown>, msg: string) => { if (await mutate(`/admin/admins/${id}`, 'PATCH', body, msg)) state.reload(); };
  return (
    <Panel actions={<Button size="sm" onClick={() => setInvite({ identifier: '', roleId: roles.data?.roles.find((r) => r.key === 'support')?.id ?? '', displayName: '', mfaRequired: true })}><Plus />Add admin</Button>}>
      <ErrorOr state={state}>
        {(rows) => (
          <DataTable<AdminRow> caption="Admin accounts" rows={rows} rowKey={(r) => r.user_id}
            columns={[
              { key: 'name', label: 'Admin', render: (a) => <div><p className="text-ink">{a.display_name}</p><p className="text-xs text-muted">{a.email ?? a.phone}</p></div> },
              { key: 'role', label: 'Role', render: (a) => (
                <NativeSelect aria-label={`Role for ${a.display_name}`} value={a.role_id} className="h-9 w-auto text-sm" onChange={(e) => update(a.user_id, { roleId: e.target.value }, 'Role updated')}>
                  {(roles.data?.roles ?? [{ id: a.role_id, name: a.role.name } as Role]).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </NativeSelect>
              ) },
              { key: 'mfa', label: 'MFA required', render: (a) => <Switch checked={a.mfa_required} onCheckedChange={(mfaRequired) => update(a.user_id, { mfaRequired }, 'MFA requirement updated')} aria-label={`Require MFA for ${a.display_name}`} /> },
              { key: 'active', label: 'Status', render: (a) => a.is_active ? (
                <ConfirmAction trigger={<Button size="sm" variant="ghost">Deactivate</Button>} title={`Deactivate ${a.display_name}?`} description="They lose admin access immediately. Their past actions remain in the audit log." confirmLabel="Deactivate" danger
                  onConfirm={() => mutate(`/admin/admins/${a.user_id}`, 'PATCH', { isActive: false }, 'Admin deactivated').then((r) => { if (r) state.reload(); return r; })} />
              ) : <Button size="sm" variant="ghost" onClick={() => update(a.user_id, { isActive: true }, 'Admin reactivated')}>Reactivate</Button> },
              { key: 'login', label: 'Added', render: (a) => fmtDateTime(a.created_at), hideOnMobile: true },
            ]} />
        )}
      </ErrorOr>
      {invite && (
        <Dialog open onOpenChange={(o) => !o && setInvite(null)}>
          <DialogContent title="Add an admin" description="The person must already have signed up with this email or mobile number.">
            <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (await mutate('/admin/admins', 'POST', invite, 'Admin added')) { setInvite(null); state.reload(); } }}>
              <Field label="Email or mobile number" htmlFor="inv-id"><Input value={invite.identifier} onChange={(e) => setInvite({ ...invite, identifier: e.target.value })} required /></Field>
              <Field label="Display name" htmlFor="inv-name"><Input value={invite.displayName} onChange={(e) => setInvite({ ...invite, displayName: e.target.value })} required /></Field>
              <Field label="Role" htmlFor="inv-role"><NativeSelect value={invite.roleId} onChange={(e) => setInvite({ ...invite, roleId: e.target.value })}>{(roles.data?.roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</NativeSelect></Field>
              <label className="flex items-center gap-2 text-sm"><Switch checked={invite.mfaRequired} onCheckedChange={(mfaRequired) => setInvite({ ...invite, mfaRequired })} aria-label="Require MFA" />Require multi-factor authentication</label>
              <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setInvite(null)}>Cancel</Button><Button type="submit" disabled={!invite.identifier || invite.displayName.length < 2 || !invite.roleId}>Add admin</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Panel>
  );
}

function Roles() {
  const state = useAdminData<{ roles: Role[]; permissions: Perm[] }>('/admin/roles');
  const [draft, setDraft] = React.useState<Record<string, string[]>>({});
  const [creating, setCreating] = React.useState<{ key: string; name: string; description: string } | null>(null);
  return (
    <ErrorOr state={state}>
      {({ roles, permissions }) => {
        const editable = roles.filter((r) => r.key !== 'super_admin');
        const perms = (r: Role) => draft[r.id] ?? r.permissions;
        const categories = [...new Set(permissions.map((p) => p.category))];
        return (
          <Panel title="Permission matrix" description="Super Admin always holds every permission and cannot be edited."
            actions={<Button size="sm" onClick={() => setCreating({ key: '', name: '', description: '' })}><Plus />New role</Button>}>
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <caption className="sr-only">Roles and permissions</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="sticky left-0 bg-surface px-5 py-2">Permission</th>
                    {editable.map((r) => <th key={r.id} scope="col" className="px-2 py-2 text-center font-medium">{r.name}<div className="font-normal">{r.memberCount} admin{r.memberCount === 1 ? '' : 's'}</div></th>)}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <React.Fragment key={cat}>
                      <tr><th colSpan={editable.length + 1} scope="colgroup" className="bg-surface-2 px-5 py-1.5 text-left text-xs uppercase tracking-wide text-muted">{cat}</th></tr>
                      {permissions.filter((p) => p.category === cat).map((p) => (
                        <tr key={p.key} className="border-b border-line/60">
                          <th scope="row" className="sticky left-0 bg-surface px-5 py-2 text-left font-normal"><span className="font-mono text-xs text-ink">{p.key}</span><p className="text-xs text-muted">{p.description}</p></th>
                          {editable.map((r) => (
                            <td key={r.id} className="px-2 py-2 text-center">
                              <input type="checkbox" className="h-4 w-4 accent-burgundy-600" aria-label={`${r.name}: ${p.key}`} checked={perms(r).includes(p.key)}
                                onChange={(e) => setDraft({ ...draft, [r.id]: e.target.checked ? [...perms(r), p.key] : perms(r).filter((x) => x !== p.key) })} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {Object.keys(draft).length > 0 && (
                <>
                  <Notice tone="warning">Unsaved changes for {Object.keys(draft).length} role(s).</Notice>
                  <Button onClick={async () => {
                    for (const [id, p] of Object.entries(draft)) if (!(await mutate(`/admin/roles/${id}`, 'PATCH', { permissions: p }))) return;
                    setDraft({}); state.reload();
                  }}>Save permissions</Button>
                  <Button variant="ghost" onClick={() => setDraft({})}>Discard</Button>
                </>
              )}
              {editable.filter((r) => !r.isSystem).map((r) => (
                <ConfirmAction key={r.id} trigger={<Button size="sm" variant="ghost" className="text-danger">Delete {r.name}</Button>} title={`Delete role ${r.name}?`} confirmLabel="Delete" danger
                  onConfirm={() => mutate(`/admin/roles/${r.id}`, 'DELETE', undefined, 'Role deleted').then((x) => { if (x) state.reload(); return x; })} />
              ))}
            </div>
            {creating && (
              <Dialog open onOpenChange={(o) => !o && setCreating(null)}>
                <DialogContent title="New role" description="Choose permissions in the matrix after creating the role.">
                  <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (await mutate('/admin/roles', 'POST', { ...creating, description: creating.description || null, permissions: [] as (typeof ADMIN_PERMISSIONS)[number][] }, 'Role created')) { setCreating(null); state.reload(); } }}>
                    <Field label="Key" htmlFor="role-key" hint="lowercase_with_underscores"><Input value={creating.key} onChange={(e) => setCreating({ ...creating, key: e.target.value })} className="font-mono" required /></Field>
                    <Field label="Name" htmlFor="role-name"><Input value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} required /></Field>
                    <Field label="Description" htmlFor="role-desc" optional><Textarea value={creating.description} onChange={(e) => setCreating({ ...creating, description: e.target.value })} className="min-h-16" /></Field>
                    <div className="flex justify-end"><Button type="submit">Create</Button></div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </Panel>
        );
      }}
    </ErrorOr>
  );
}

interface PlanRow { id: string; code: string; name: string; tagline: string | null; description: string | null; sort_order: number; is_public: boolean; is_active: boolean; plan_prices: { id: string; interval: string; amount_paise: number; razorpay_plan_id: string | null; is_active: boolean }[]; plan_entitlements: { key: string; value: unknown }[] }
interface PlansData { plans: PlanRow[]; entitlementKeys: { key: string; type: string; default: unknown }[] }

function Plans() {
  const state = useAdminData<PlansData>('/admin/plans');
  return (
    <ErrorOr state={state}>
      {(d) => (
        <div className="space-y-4">
          <Notice>Prices are GST-inclusive list prices in rupees. Changing a price affects new checkouts only; existing subscriptions keep their terms.</Notice>
          {d.plans.map((p) => <PlanEditor key={p.id} plan={p} keys={d.entitlementKeys} onSaved={state.reload} />)}
        </div>
      )}
    </ErrorOr>
  );
}

function PlanEditor({ plan, keys, onSaved }: { plan: PlanRow; keys: PlansData['entitlementKeys']; onSaved: () => void }) {
  const [meta, setMeta] = React.useState({ name: plan.name, tagline: plan.tagline ?? '', description: plan.description ?? '', isPublic: plan.is_public, isActive: plan.is_active });
  const current = Object.fromEntries(plan.plan_entitlements.map((e) => [e.key, e.value]));
  const [ent, setEnt] = React.useState<Record<string, unknown>>(Object.fromEntries(keys.map((k) => [k.key, current[k.key] ?? k.default])));
  const [prices, setPrices] = React.useState<Record<string, { amount: string; razorpayPlanId: string; isActive: boolean }>>(
    Object.fromEntries(BILLING_INTERVALS.map((i) => { const pr = plan.plan_prices.find((x) => x.interval === i); return [i, { amount: pr ? String(pr.amount_paise / 100) : '', razorpayPlanId: pr?.razorpay_plan_id ?? '', isActive: pr?.is_active ?? true }]; })),
  );
  return (
    <Panel title={`${plan.name} (${plan.code})`} actions={<Badge tone={plan.is_active ? 'success' : 'outline'}>{plan.is_active ? 'Active' : 'Inactive'}</Badge>}>
      <div className="grid gap-6 lg:grid-cols-3">
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await mutate(`/admin/plans/${plan.id}`, 'PATCH', { ...meta, tagline: meta.tagline || null, description: meta.description || null }, 'Plan saved')) onSaved(); }}>
          <h3 className="text-sm font-semibold">Details</h3>
          <Field label="Name" htmlFor={`pn-${plan.id}`}><Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></Field>
          <Field label="Tagline" htmlFor={`pt-${plan.id}`}><Input value={meta.tagline} onChange={(e) => setMeta({ ...meta, tagline: e.target.value })} /></Field>
          <Field label="Description" htmlFor={`pd-${plan.id}`}><Textarea value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} className="min-h-20" /></Field>
          <label className="flex items-center gap-2 text-sm"><Switch checked={meta.isPublic} onCheckedChange={(isPublic) => setMeta({ ...meta, isPublic })} aria-label="Public" />Shown on pricing page</label>
          {plan.code !== 'free' && <label className="flex items-center gap-2 text-sm"><Switch checked={meta.isActive} onCheckedChange={(isActive) => setMeta({ ...meta, isActive })} aria-label="Active" />Active</label>}
          <Button type="submit" size="sm">Save details</Button>
        </form>
        {plan.code !== 'free' ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Prices</h3>
            {BILLING_INTERVALS.map((i) => (
              <div key={i} className="space-y-1.5 rounded-xl border border-line p-3">
                <div className="flex items-center justify-between text-sm"><span>{BILLING_INTERVAL_LABELS[i]}</span>{plan.plan_prices.find((x) => x.interval === i) && <span className="text-xs text-muted">now {fmtInr(plan.plan_prices.find((x) => x.interval === i)!.amount_paise)}</span>}</div>
                <div className="flex gap-2">
                  <Input aria-label={`${BILLING_INTERVAL_LABELS[i]} price in rupees`} type="number" min={1} step="1" placeholder="₹" value={prices[i]!.amount} onChange={(e) => setPrices({ ...prices, [i]: { ...prices[i]!, amount: e.target.value } })} className="h-9 text-sm" />
                  <Input aria-label={`${BILLING_INTERVAL_LABELS[i]} Razorpay plan id`} placeholder="Razorpay plan id" value={prices[i]!.razorpayPlanId} onChange={(e) => setPrices({ ...prices, [i]: { ...prices[i]!, razorpayPlanId: e.target.value } })} className="h-9 text-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs"><Switch checked={prices[i]!.isActive} onCheckedChange={(isActive) => setPrices({ ...prices, [i]: { ...prices[i]!, isActive } })} aria-label={`${BILLING_INTERVAL_LABELS[i]} active`} />Offered</label>
                  <Button size="sm" variant="ghost" disabled={!prices[i]!.amount} onClick={async () => { if (await mutate(`/admin/plans/${plan.id}/prices`, 'POST', { interval: i, amountPaise: Math.round(Number(prices[i]!.amount) * 100), razorpayPlanId: prices[i]!.razorpayPlanId || null, isActive: prices[i]!.isActive }, 'Price saved')) onSaved(); }}>Save</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted">The Free plan has no prices.</p>}
        <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await mutate(`/admin/plans/${plan.id}/entitlements`, 'PUT', { values: ent }, 'Entitlements saved')) onSaved(); }}>
          <h3 className="text-sm font-semibold">Entitlements</h3>
          {keys.map((k) => (
            <div key={k.key} className="flex items-center justify-between gap-2 text-sm">
              <label htmlFor={`e-${plan.id}-${k.key}`} className="text-ink-2">{human(k.key)}</label>
              {k.type === 'boolean' ? <Switch id={`e-${plan.id}-${k.key}`} checked={!!ent[k.key]} onCheckedChange={(v) => setEnt({ ...ent, [k.key]: v })} />
                : k.key === 'ai_insights' ? <NativeSelect id={`e-${plan.id}-${k.key}`} value={String(ent[k.key])} onChange={(e) => setEnt({ ...ent, [k.key]: e.target.value })} className="h-8 w-28 text-xs">{['none', 'basic', 'full'].map((v) => <option key={v}>{v}</option>)}</NativeSelect>
                : <Input id={`e-${plan.id}-${k.key}`} type="number" min={0} value={String(ent[k.key])} onChange={(e) => setEnt({ ...ent, [k.key]: Number(e.target.value) })} className="h-8 w-24 text-xs" />}
            </div>
          ))}
          <Button type="submit" size="sm" className="mt-2">Save entitlements</Button>
        </form>
      </div>
    </Panel>
  );
}

interface SystemData {
  health: { database: string; dbLatencyMs: number; checkedAt: string };
  integrations: Record<string, boolean>;
  queues: Record<string, number>;
  recentAiErrors: { id: number; feature: string; model: string; status: string; error_code: string | null; created_at: string }[];
  notificationDeliveries7d: ({ channel: string } & Record<string, number | string>)[];
  lastWebhookEvent: { id: string; event_type: string; received_at: string; processed_at: string | null; error: string | null } | null;
}

const INTEGRATION_LABELS: Record<string, string> = { anthropic: 'Anthropic (AI)', voyage: 'Voyage (embeddings)', razorpay: 'Razorpay payments', razorpayWebhooks: 'Razorpay webhooks', email: 'Email (Resend)', sms: 'SMS (MSG91)', whatsapp: 'WhatsApp Cloud API', push: 'Push (Expo)' };

function SystemTab() {
  const state = useAdminData<SystemData>('/admin/system');
  return (
    <ErrorOr state={state}>
      {(s) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Database" value={s.health.database === 'ok' ? 'Healthy' : 'Error'} hint={`${s.health.dbLatencyMs} ms`} />
            {Object.entries(s.queues).map(([k, v]) => <StatCard key={k} label={human(k.replace(/([A-Z])/g, ' $1'))} current={v} invert />)}
          </div>
          <Panel title="Integrations" description="Unconfigured services degrade gracefully; see docs/INTEGRATIONS.md for setup.">
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(s.integrations).map(([k, ok]) => (
                <li key={k} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm"><span>{INTEGRATION_LABELS[k] ?? k}</span><Badge tone={ok ? 'success' : 'warning'}>{ok ? 'Configured' : 'Not configured'}</Badge></li>
              ))}
            </ul>
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Notification deliveries (7 days)">
              <DataTable caption="Deliveries by channel" rows={s.notificationDeliveries7d.map((d) => ({ ...d, id: d.channel }) as Record<string, number | string>)} empty="No deliveries."
                columns={[{ key: 'channel', label: 'Channel', render: (d) => human(String(d.channel)) }, { key: 'sent', label: 'Sent', render: (d) => d.sent ?? 0 }, { key: 'failed', label: 'Failed', render: (d) => d.failed ?? 0 }, { key: 'skipped', label: 'Skipped (unconfigured)', render: (d) => d.skipped_unconfigured ?? 0 }]} />
            </Panel>
            <Panel title="Last payment webhook">
              {s.lastWebhookEvent ? <KeyValues items={[['Event', s.lastWebhookEvent.event_type], ['Received', fmtDateTime(s.lastWebhookEvent.received_at)], ['Processed', fmtDateTime(s.lastWebhookEvent.processed_at)], ['Error', s.lastWebhookEvent.error]]} /> : <p className="text-sm text-muted">No webhook events received yet.</p>}
            </Panel>
          </div>
          <Panel title="Recent AI errors (24h)">
            <DataTable caption="Recent AI errors" rows={s.recentAiErrors} empty="No AI errors in the last 24 hours."
              columns={[{ key: 'feature', label: 'Feature', render: (e) => human(e.feature) }, { key: 'model', label: 'Model', render: (e) => <span className="font-mono text-xs">{e.model}</span> }, { key: 'status', label: 'Status', render: (e) => <StatusBadge status={e.status === 'error' ? 'failed' : 'rejected'} /> }, { key: 'code', label: 'Code', render: (e) => e.error_code ?? '—' }, { key: 'when', label: 'When', render: (e) => fmtDateTime(e.created_at) }]} />
          </Panel>
          <p className="text-xs text-muted">Checked {fmtDateTime(s.health.checkedAt)} · <button type="button" className="underline" onClick={state.reload}>Refresh</button></p>
        </div>
      )}
    </ErrorOr>
  );
}
