'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Eye } from 'lucide-react';
import { Badge, Button, Field, Input, NativeSelect } from '@/components/ui';
import {
  AdminHeader, ConfirmAction, DataTable, ErrorOr, FilterSelect, KeyValues, Pager, Panel, SearchBox, StatusBadge,
  fmtDate, fmtDateTime, fmtInr, human, mutate, qs, useAdminData, useCan, type Paged,
} from '../kit';

interface UserRow {
  id: string; name: string | null; email: string | null; phone: string | null; status: string; createdAt: string; lastActiveAt: string | null; plan: string;
  profile: { id: string; code: string; status: string; completion: number; identityVerified: boolean; photoVerified: boolean } | null;
}

export function UsersPage() {
  const router = useRouter();
  const [f, setF] = React.useState({ q: '', status: '', plan: '', verified: '', from: '', to: '', page: 1 });
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, page: 1, ...patch }));
  const state = useAdminData<Paged<UserRow>>(`/admin/users${qs(f)}`);
  return (
    <>
      <AdminHeader title="Users" description="Search members by name, email, phone or profile code (e.g. TK100123). Contact details stay masked unless revealed with permission." />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <SearchBox label="Search users" value={f.q} onChange={(q) => set({ q })} placeholder="Name, email, phone or TK code" />
          <FilterSelect label="Status" value={f.status} onChange={(status) => set({ status })} options={[['', 'All statuses'], ['active', 'Active'], ['suspended', 'Suspended'], ['pending_deletion', 'Pending deletion'], ['deleted', 'Deleted']]} />
          <FilterSelect label="Plan" value={f.plan} onChange={(plan) => set({ plan })} options={[['', 'All plans'], ['free', 'Free'], ['plus', 'Plus'], ['premium', 'Premium'], ['elite', 'Elite']]} />
          <FilterSelect label="Identity verification" value={f.verified} onChange={(verified) => set({ verified })} options={[['', 'Any verification'], ['true', 'ID verified'], ['false', 'Not ID verified']]} />
          <Input type="date" aria-label="Joined from" value={f.from} onChange={(e) => set({ from: e.target.value })} className="h-10 w-auto text-sm" />
          <Input type="date" aria-label="Joined to" value={f.to} onChange={(e) => set({ to: e.target.value })} className="h-10 w-auto text-sm" />
        </div>
        <ErrorOr state={state}>
          {(d) => (
            <>
              <DataTable<UserRow>
                caption="Users"
                rows={d.items}
                onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
                columns={[
                  { key: 'name', label: 'Member', render: (u) => (
                    <div><p className="font-medium text-ink">{u.name ?? 'Unnamed'}</p><p className="text-xs text-muted">{u.email ?? u.phone ?? '—'}</p></div>
                  ) },
                  { key: 'profile', label: 'Profile', render: (u) => u.profile ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="font-mono">{u.profile.code}</span>
                      {u.profile.identityVerified && <BadgeCheck className="h-4 w-4 text-success" aria-label="ID verified" />}
                      <span className="text-muted">{u.profile.completion}%</span>
                    </span>
                  ) : <span className="text-xs text-muted">No profile</span> },
                  { key: 'plan', label: 'Plan', render: (u) => <Badge tone={u.plan === 'free' ? 'outline' : 'gold'} className="capitalize">{u.plan}</Badge> },
                  { key: 'status', label: 'Status', render: (u) => <StatusBadge status={u.status} /> },
                  { key: 'createdAt', label: 'Joined', render: (u) => fmtDate(u.createdAt), hideOnMobile: true },
                  { key: 'lastActiveAt', label: 'Last active', render: (u) => fmtDateTime(u.lastActiveAt), hideOnMobile: true },
                ]}
              />
              <Pager page={d.page} pages={d.pages} total={d.total} onPage={(page) => setF((s) => ({ ...s, page }))} />
            </>
          )}
        </ErrorOr>
      </Panel>
    </>
  );
}

interface UserDetail {
  user: { id: string; email: string | null; phone: string | null; full_name: string | null; status: string; suspended_reason: string | null; suspended_until: string | null; preferred_locale: string; created_at: string; last_active_at: string | null; deletion_requested_at: string | null; hasEmail: boolean; hasPhone: boolean };
  profile: { id: string; profile_code: string; first_name: string | null; last_name: string | null; status: string; visibility: string; completion_pct: number; is_identity_verified: boolean; is_photo_verified: boolean; created_for: string; current_city: string | null } | null;
  subscriptions: { id: string; status: string; current_period_end: string | null; granted_by_admin: string | null; created_at: string; plan: { code: string; name: string } | null }[];
  payments: { id: string; amount_paise: number; status: string; method: string | null; paid_at: string | null; created_at: string }[];
  reportsBy: { id: string; reason: string; status: string; created_at: string }[];
  reportsAgainst: { id: string; reason: string; status: string; priority: string; created_at: string }[];
  moderation: { id: string; action: string; reason: string; created_at: string; expires_at: string | null }[];
  riskSignals: { id: string; kind: string; severity: number; status: string; created_at: string }[];
  activity: { id: number; action: string; entity_type: string; actor_type: string; created_at: string }[];
  verifications: { id: string; kind: string; status: string; created_at: string }[];
  dataRequests: { id: string; kind: string; status: string; scheduled_for: string | null }[];
}

export function UserDetailPage({ id }: { id: string }) {
  const state = useAdminData<UserDetail>(`/admin/users/${id}`);
  const can = useCan();
  const [contact, setContact] = React.useState<{ email: string | null; phone: string | null; signupIp: string | null } | null>(null);

  return (
    <ErrorOr state={state} rows={10}>
      {(d) => {
        const name = d.user.full_name ?? ([d.profile?.first_name, d.profile?.last_name].filter(Boolean).join(' ') || 'Unnamed member');
        const activeSub = d.subscriptions.find((s) => s.status === 'active' && s.current_period_end && new Date(s.current_period_end) > new Date());
        return (
          <>
            <AdminHeader
              title={name}
              description={`Joined ${fmtDate(d.user.created_at)} · last active ${fmtDateTime(d.user.last_active_at)}`}
              actions={
                <>
                  <StatusBadge status={d.user.status} />
                  {can('users.manage') && d.user.status === 'active' && (
                    <ConfirmAction trigger={<Button variant="secondary" size="sm">Suspend</Button>} title="Suspend account" description="The member is signed out and hidden from discovery. This is a human decision recorded with your reason."
                      confirmLabel="Suspend" requireReason danger
                      extra={<SuspendUntil />}
                      onConfirm={(reason) => {
                        const until = (document.getElementById('suspend-until') as HTMLInputElement | null)?.value;
                        return mutate(`/admin/users/${id}/suspend`, 'POST', { reason, until: until ? new Date(until).toISOString() : null }, 'Account suspended').then((r) => { if (r) state.reload(); return r; });
                      }} />
                  )}
                  {can('users.manage') && d.user.status === 'suspended' && (
                    <ConfirmAction trigger={<Button variant="secondary" size="sm">Reactivate</Button>} title="Reactivate account" confirmLabel="Reactivate" requireReason
                      onConfirm={(reason) => mutate(`/admin/users/${id}/reactivate`, 'POST', { reason }, 'Account reactivated').then((r) => { if (r) state.reload(); return r; })} />
                  )}
                  {can('users.manage') && !['deleted', 'pending_deletion'].includes(d.user.status) && (
                    <ConfirmAction trigger={<Button variant="ghost" size="sm" className="text-danger">Delete…</Button>} title="Schedule account deletion"
                      description="Deletion runs through the standard privacy pipeline after the grace period. The profile is hidden immediately." confirmLabel="Schedule deletion" requireReason confirmWord="DELETE" danger
                      onConfirm={(reason) => mutate(`/admin/users/${id}/delete`, 'POST', { reason, confirm: 'DELETE' }, 'Deletion scheduled').then((r) => { if (r) state.reload(); return r; })} />
                  )}
                </>
              }
            />
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <Panel title="Account" actions={can('sensitive_data.read') && !contact && (d.user.hasEmail || d.user.hasPhone) ? (
                  <Button size="sm" variant="ghost" onClick={async () => { const c = await mutate<{ email: string | null; phone: string | null; signupIp: string | null }>(`/admin/users/${id}/contact`, 'GET'); if (c) setContact(c); }}><Eye />Reveal contact (audited)</Button>
                ) : undefined}>
                  <KeyValues items={[
                    ['Email', contact?.email ?? d.user.email], ['Phone', contact?.phone ?? d.user.phone], ['Language', d.user.preferred_locale.toUpperCase()],
                    ['Status', <StatusBadge key="s" status={d.user.status} />],
                    ...(d.user.suspended_reason ? [['Suspension reason', d.user.suspended_reason] as [string, React.ReactNode], ['Suspended until', d.user.suspended_until ? fmtDateTime(d.user.suspended_until) : 'Indefinite'] as [string, React.ReactNode]] : []),
                    ...(contact?.signupIp ? [['Sign-up IP', contact.signupIp] as [string, React.ReactNode]] : []),
                    ...(d.user.deletion_requested_at ? [['Deletion requested', fmtDateTime(d.user.deletion_requested_at)] as [string, React.ReactNode]] : []),
                  ]} />
                </Panel>
                <Panel title="Profile" actions={d.profile && can('profiles.read') ? <Link className="text-sm text-emerald-600 hover:underline" href={`/admin/profiles/${d.profile.id}`}>Open profile</Link> : undefined}>
                  {d.profile ? (
                    <KeyValues items={[
                      ['Code', <span key="c" className="font-mono">{d.profile.profile_code}</span>], ['Created for', human(d.profile.created_for)], ['City', d.profile.current_city],
                      ['Profile status', <StatusBadge key="ps" status={d.profile.status} />], ['Completion', `${d.profile.completion_pct}%`],
                      ['Verified identity', d.profile.is_identity_verified ? 'Yes — government ID checked' : 'No'], ['Verified photo', d.profile.is_photo_verified ? 'Yes' : 'No'],
                    ]} />
                  ) : <p className="text-sm text-muted">This account has not created a profile yet.</p>}
                </Panel>
                <Panel title="Activity history" description="Audit trail of actions by or about this member.">
                  <DataTable caption="Activity" rows={d.activity} empty="No recorded activity."
                    columns={[{ key: 'action', label: 'Action', render: (a) => <span className="font-mono text-xs">{a.action}</span> }, { key: 'actor_type', label: 'By', render: (a) => human(a.actor_type) }, { key: 'created_at', label: 'When', render: (a) => fmtDateTime(a.created_at) }]} />
                </Panel>
                <div className="grid gap-4 md:grid-cols-2">
                  <Panel title="Reports against">
                    <DataTable caption="Reports against member" rows={d.reportsAgainst} empty="None." columns={[{ key: 'reason', label: 'Reason', render: (r) => human(r.reason) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'created_at', label: 'Filed', render: (r) => fmtDate(r.created_at) }]} />
                  </Panel>
                  <Panel title="Reports filed">
                    <DataTable caption="Reports filed by member" rows={d.reportsBy} empty="None." columns={[{ key: 'reason', label: 'Reason', render: (r) => human(r.reason) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'created_at', label: 'Filed', render: (r) => fmtDate(r.created_at) }]} />
                  </Panel>
                </div>
              </div>
              <div className="space-y-4">
                <Panel title="Subscription">
                  <p className="text-sm">{activeSub ? <><span className="font-medium">{activeSub.plan?.name}</span> until {fmtDate(activeSub.current_period_end)}{activeSub.granted_by_admin && <Badge tone="info" className="ml-2">Granted</Badge>}</> : 'Free plan'}</p>
                  {can('subscriptions.manage') && <SubscriptionManager userId={id} hasActive={!!activeSub} onDone={state.reload} />}
                  {d.payments.length > 0 && (
                    <ul className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
                      {d.payments.map((p) => <li key={p.id} className="flex justify-between"><span>{fmtInr(p.amount_paise)} · {fmtDate(p.paid_at ?? p.created_at)}</span><StatusBadge status={p.status} /></li>)}
                    </ul>
                  )}
                </Panel>
                <Panel title="Moderation history">
                  {d.moderation.length ? (
                    <ul className="space-y-3 text-sm">{d.moderation.map((m) => <li key={m.id}><p className="font-medium capitalize">{human(m.action)} <span className="text-xs font-normal text-muted">· {fmtDate(m.created_at)}</span></p><p className="text-muted">{m.reason}</p></li>)}</ul>
                  ) : <p className="text-sm text-muted">No actions taken.</p>}
                </Panel>
                <Panel title="Risk signals" description="Automated — reviewed by people, never auto-enforced.">
                  {d.riskSignals.length ? (
                    <ul className="space-y-2 text-sm">{d.riskSignals.map((r) => <li key={r.id} className="flex justify-between gap-2"><span className="capitalize">{human(r.kind)} · severity {r.severity}</span><StatusBadge status={r.status} /></li>)}</ul>
                  ) : <p className="text-sm text-muted">No signals.</p>}
                </Panel>
                <Panel title="Verifications">
                  {d.verifications.length ? (
                    <ul className="space-y-2 text-sm">{d.verifications.map((v) => <li key={v.id} className="flex justify-between"><span className="capitalize">{human(v.kind)}</span><StatusBadge status={v.status} /></li>)}</ul>
                  ) : <p className="text-sm text-muted">None submitted.</p>}
                </Panel>
                {d.dataRequests.length > 0 && (
                  <Panel title="Privacy requests">
                    <ul className="space-y-2 text-sm">{d.dataRequests.map((r) => <li key={r.id} className="flex justify-between"><span className="capitalize">{r.kind}{r.scheduled_for ? ` · ${fmtDate(r.scheduled_for)}` : ''}</span><StatusBadge status={r.status} /></li>)}</ul>
                  </Panel>
                )}
              </div>
            </div>
          </>
        );
      }}
    </ErrorOr>
  );
}

function SuspendUntil() {
  return (
    <Field label="Suspend until (optional)" htmlFor="suspend-until" hint="Leave empty for an indefinite suspension.">
      <Input type="datetime-local" />
    </Field>
  );
}

function SubscriptionManager({ userId, hasActive, onDone }: { userId: string; hasActive: boolean; onDone: () => void }) {
  const [plan, setPlan] = React.useState('premium');
  const [days, setDays] = React.useState(30);
  return (
    <div className="mt-4 space-y-3 border-t border-line pt-3">
      <div className="flex gap-2">
        <NativeSelect aria-label="Plan to grant" value={plan} onChange={(e) => setPlan(e.target.value)} className="h-10 text-sm"><option value="plus">Plus</option><option value="premium">Premium</option><option value="elite">Elite</option></NativeSelect>
        <Input aria-label="Days" type="number" min={1} max={730} value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 w-24 text-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <ConfirmAction trigger={<Button size="sm" variant="secondary">Grant</Button>} title={`Grant ${plan} for ${days} days`} description="Replaces any current paid plan. No payment is collected." confirmLabel="Grant" requireReason
          onConfirm={(reason) => mutate(`/admin/users/${userId}/subscription`, 'POST', { action: 'grant', planCode: plan, days, reason }, 'Plan granted').then((r) => { if (r) onDone(); return r; })} />
        {hasActive && (
          <>
            <ConfirmAction trigger={<Button size="sm" variant="ghost">Extend {days}d</Button>} title={`Extend by ${days} days`} confirmLabel="Extend" requireReason
              onConfirm={(reason) => mutate(`/admin/users/${userId}/subscription`, 'POST', { action: 'extend', days, reason }, 'Subscription extended').then((r) => { if (r) onDone(); return r; })} />
            <ConfirmAction trigger={<Button size="sm" variant="ghost" className="text-danger">Cancel</Button>} title="Cancel subscription now" description="Access ends immediately. Refunds are handled separately in Payments." confirmLabel="Cancel subscription" requireReason danger
              onConfirm={(reason) => mutate(`/admin/users/${userId}/subscription`, 'POST', { action: 'cancel', reason }, 'Subscription cancelled').then((r) => { if (r) onDone(); return r; })} />
          </>
        )}
      </div>
    </div>
  );
}
