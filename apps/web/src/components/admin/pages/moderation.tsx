'use client';
import * as React from 'react';
import Link from 'next/link';
import { REPORT_REASON_OPTIONS, labelOf, type ReportReason } from '@2k/shared';
import { Button, Field, Input, NativeSelect, Notice, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui';
import { AdminHeader, DataTable, Drawer, ErrorOr, FilterSelect, KeyValues, Pager, Panel, StatusBadge, fmtDateTime, human, mutate, qs, useAdminData, useCan, type Paged } from '../kit';

interface ReportRow { id: string; reason: string; status: string; priority: string; created_at: string; targetCode: string | null; targetName: string | null; assignedToMe: boolean; assigned_to: string | null; kind: string }
interface ReportDetail {
  report: { id: string; reason: string; details: string | null; status: string; priority: string; resolution: string | null; created_at: string; target_message_id: string | null; target_photo_id: string | null; assigned_to: string | null };
  target: { id: string; owner_user_id: string; profile_code: string; first_name: string | null; status: string; current_city: string | null; about: string | null; created_at: string } | null;
  reporter: { profile_code: string; first_name: string | null } | null;
  message: { id: string; body: string | null; kind: string; created_at: string; flagged: boolean; deleted_at: string | null } | null;
  photo: { id: string; url: string | null; moderationStatus: string } | null;
  totalReportsAgainstTarget: number;
  actions: { id: string; action: string; reason: string; created_at: string }[];
}

export function ModerationPage() {
  const can = useCan();
  return (
    <>
      <AdminHeader title="Trust & Safety" description="Reports and automated signals. Every enforcement is a human decision with a written reason." />
      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          {can('risk.review') && <TabsTrigger value="risk">Risk signals</TabsTrigger>}
          <TabsTrigger value="history">Action history</TabsTrigger>
        </TabsList>
        <TabsContent value="reports"><ReportsQueue /></TabsContent>
        {can('risk.review') && <TabsContent value="risk"><RiskQueue /></TabsContent>}
        <TabsContent value="history"><ActionHistory /></TabsContent>
      </Tabs>
    </>
  );
}

function ReportsQueue() {
  const [f, setF] = React.useState({ status: 'open', priority: '', mine: false, page: 1 });
  const state = useAdminData<Paged<ReportRow>>(`/admin/reports${qs(f)}`);
  const [openId, setOpenId] = React.useState<string | null>(null);
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect label="Status" value={f.status} onChange={(status) => setF({ ...f, status, page: 1 })} options={[['open', 'Open'], ['actioned', 'Actioned'], ['dismissed', 'Dismissed'], ['all', 'All']]} />
        <FilterSelect label="Priority" value={f.priority} onChange={(priority) => setF({ ...f, priority, page: 1 })} options={[['', 'Any priority'], ['urgent', 'Urgent'], ['high', 'High'], ['normal', 'Normal'], ['low', 'Low']]} />
        <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" checked={f.mine} onChange={(e) => setF({ ...f, mine: e.target.checked, page: 1 })} className="h-4 w-4 accent-burgundy-600" />Assigned to me</label>
      </div>
      <ErrorOr state={state}>
        {(d) => (
          <>
            <DataTable<ReportRow> caption="Reports" rows={d.items} onRowClick={(r) => setOpenId(r.id)} empty="No reports in this view."
              columns={[
                { key: 'reason', label: 'Reason', render: (r) => <span className="text-ink">{labelOf(REPORT_REASON_OPTIONS, r.reason as ReportReason)}</span> },
                { key: 'target', label: 'Reported', render: (r) => <span><span className="font-mono text-xs">{r.targetCode ?? '—'}</span> {r.targetName}</span> },
                { key: 'kind', label: 'About', render: (r) => human(r.kind), hideOnMobile: true },
                { key: 'priority', label: 'Priority', render: (r) => <StatusBadge status={r.priority} /> },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'assigned', label: 'Assignee', render: (r) => (r.assignedToMe ? 'Me' : r.assigned_to ? 'Someone' : '—'), hideOnMobile: true },
                { key: 'created', label: 'Filed', render: (r) => fmtDateTime(r.created_at), hideOnMobile: true },
              ]} />
            <Pager page={d.page} pages={d.pages} total={d.total} onPage={(page) => setF({ ...f, page })} />
          </>
        )}
      </ErrorOr>
      <Drawer open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} title="Report">
        {openId && <ReportPanel id={openId} onChanged={state.reload} onClose={() => setOpenId(null)} />}
      </Drawer>
    </Panel>
  );
}

const ACTIONS: [string, string, boolean][] = [
  ['warn', 'Send a warning', false], ['hide_profile', 'Hide profile', false], ['suspend', 'Suspend account', true], ['ban', 'Ban account', true],
  ['remove_photo', 'Remove reported photo', false], ['remove_message', 'Remove reported message', false], ['clear_flag', 'Clear message flag', false], ['reinstate', 'Reinstate', false],
];

function ReportPanel({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const state = useAdminData<ReportDetail>(`/admin/reports/${id}`);
  const can = useCan();
  const [action, setAction] = React.useState('warn');
  const [reason, setReason] = React.useState('');
  const [until, setUntil] = React.useState('');
  const [resolution, setResolution] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const refresh = () => { state.reload(); onChanged(); };
  const serious = ACTIONS.find((a) => a[0] === action)?.[2];

  return (
    <ErrorOr state={state}>
      {(d) => {
        const r = d.report;
        const open = ['open', 'in_review'].includes(r.status);
        const available = ACTIONS.filter(([k]) => (k === 'remove_photo' ? !!d.photo : k === 'remove_message' || k === 'clear_flag' ? !!d.message : true));
        return (
          <div className="space-y-5">
            <KeyValues items={[
              ['Reason', labelOf(REPORT_REASON_OPTIONS, r.reason as ReportReason)], ['Status', <StatusBadge key="s" status={r.status} />],
              ['Priority', <StatusBadge key="p" status={r.priority} />], ['Filed', fmtDateTime(r.created_at)],
              ['Reported by', d.reporter ? `${d.reporter.profile_code} · ${d.reporter.first_name ?? ''}` : 'Deleted account'],
              ['Total reports against this member', d.totalReportsAgainstTarget],
            ]} />
            {r.details && <blockquote className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">“{r.details}”</blockquote>}
            {d.target && (
              <div className="rounded-xl border border-line p-4 text-sm">
                <p className="font-medium"><Link href={`/admin/profiles/${d.target.id}`} className="text-burgundy-600 hover:underline">{d.target.profile_code} · {d.target.first_name}</Link> <StatusBadge status={d.target.status} /></p>
                {d.target.about && <p className="mt-2 line-clamp-3 text-muted">{d.target.about}</p>}
              </div>
            )}
            {d.message && (
              <div className="rounded-xl border border-line p-4 text-sm">
                <p className="mb-1 text-xs uppercase tracking-wide text-muted">Reported message only · {fmtDateTime(d.message.created_at)}</p>
                <p className="whitespace-pre-line">{d.message.kind === 'image' ? '[Image]' : d.message.body}</p>
                {d.message.deleted_at && <p className="mt-1 text-xs text-danger">Removed</p>}
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {d.photo?.url && <img src={d.photo.url} alt="Reported photo" className="max-h-72 rounded-xl border border-line" />}
            {d.actions.length > 0 && <ul className="space-y-1 text-sm">{d.actions.map((a) => <li key={a.id}><span className="font-medium capitalize">{human(a.action)}</span> — {a.reason} <span className="text-muted">({fmtDateTime(a.created_at)})</span></li>)}</ul>}
            {r.resolution && <Notice>{r.resolution}</Notice>}

            {open && (
              <>
                <div className="flex flex-wrap gap-2">
                  {!r.assigned_to && <Button size="sm" variant="secondary" onClick={async () => { if (await mutate(`/admin/reports/${id}`, 'PATCH', { assignToMe: true, status: 'in_review' }, 'Assigned to you')) refresh(); }}>Assign to me</Button>}
                  <NativeSelect aria-label="Change priority" className="h-9 w-auto text-sm" value={r.priority} onChange={async (e) => { if (await mutate(`/admin/reports/${id}`, 'PATCH', { priority: e.target.value }, 'Priority updated')) refresh(); }}>
                    {['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{human(p)} priority</option>)}
                  </NativeSelect>
                </div>
                {can('moderation.act') && (
                  <form className="space-y-3 rounded-xl border border-line p-4" onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    const ok = await mutate('/admin/moderation', 'POST', {
                      action, reason: reason.trim(), reportId: id, targetProfileId: d.target?.id,
                      photoId: action === 'remove_photo' ? d.photo?.id : undefined,
                      messageId: ['remove_message', 'clear_flag'].includes(action) ? d.message?.id : undefined,
                      expiresAt: action === 'suspend' && until ? new Date(until).toISOString() : undefined,
                    }, 'Action recorded');
                    setBusy(false);
                    if (ok) { setReason(''); refresh(); }
                  }}>
                    <h3 className="text-sm font-semibold">Take action</h3>
                    <NativeSelect aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)} className="h-10 text-sm">
                      {available.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </NativeSelect>
                    {action === 'suspend' && <Field label="Until (optional)" htmlFor="mod-until"><Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>}
                    <Field label="Reason (recorded; warnings are shown to the member)" htmlFor="mod-reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-20" /></Field>
                    {serious && <Notice tone="warning">This is a serious enforcement. Make sure the evidence supports it.</Notice>}
                    <Button type="submit" variant={serious ? 'danger' : 'primary'} disabled={reason.trim().length < 5} loading={busy}>Apply</Button>
                  </form>
                )}
                <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await mutate(`/admin/reports/${id}`, 'PATCH', { status: 'dismissed', resolution: resolution.trim() }, 'Report dismissed')) { onChanged(); onClose(); } }}>
                  <Field label="Dismiss with note" htmlFor="dismiss-note"><Input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Why no action is needed" /></Field>
                  <Button type="submit" size="sm" variant="ghost" disabled={resolution.trim().length < 3}>Dismiss report</Button>
                </form>
              </>
            )}
          </div>
        );
      }}
    </ErrorOr>
  );
}

interface Risk { id: string; user_id: string | null; kind: string; severity: number; details: Record<string, unknown>; status: string; created_at: string; profileCode: string | null }

function RiskQueue() {
  const [f, setF] = React.useState({ status: 'open', page: 1 });
  const state = useAdminData<Paged<Risk>>(`/admin/risk${qs(f)}`);
  const review = async (id: string, status: string) => { if (await mutate(`/admin/risk/${id}`, 'PATCH', { status }, 'Signal reviewed')) state.reload(); };
  return (
    <Panel description="Signals are hints for review. Nothing is enforced automatically.">
      <div className="mb-4"><FilterSelect label="Status" value={f.status} onChange={(status) => setF({ status, page: 1 })} options={[['open', 'Open'], ['reviewed_ok', 'Reviewed OK'], ['actioned', 'Actioned'], ['dismissed', 'Dismissed'], ['all', 'All']]} /></div>
      <ErrorOr state={state}>
        {(d) => (
          <>
            <DataTable<Risk> caption="Risk signals" rows={d.items} empty="No signals."
              columns={[
                { key: 'kind', label: 'Signal', render: (r) => <span className="capitalize text-ink">{human(r.kind)}</span> },
                { key: 'severity', label: 'Severity', render: (r) => `${r.severity}/5` },
                { key: 'member', label: 'Member', render: (r) => r.user_id ? <Link className="font-mono text-xs text-burgundy-600 hover:underline" href={`/admin/users/${r.user_id}`}>{r.profileCode ?? 'Account'}</Link> : '—' },
                { key: 'details', label: 'Details', render: (r) => <code className="text-xs">{JSON.stringify(r.details).slice(0, 80)}</code>, hideOnMobile: true },
                { key: 'created', label: 'Raised', render: (r) => fmtDateTime(r.created_at), hideOnMobile: true },
                { key: 'actions', label: 'Review', render: (r) => r.status === 'open' ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => review(r.id, 'reviewed_ok')}>OK</Button>
                    <Button size="sm" variant="ghost" onClick={() => review(r.id, 'dismissed')}>Dismiss</Button>
                    <Button size="sm" variant="ghost" onClick={() => review(r.id, 'actioned')}>Actioned</Button>
                  </div>
                ) : <StatusBadge status={r.status} /> },
              ]} />
            <Pager page={d.page} pages={d.pages} total={d.total} onPage={(page) => setF({ ...f, page })} />
          </>
        )}
      </ErrorOr>
    </Panel>
  );
}

function ActionHistory() {
  const [page, setPage] = React.useState(1);
  const state = useAdminData<Paged<{ id: string; action: string; reason: string; created_at: string; target_user_id: string | null; expires_at: string | null }>>(`/admin/moderation${qs({ page })}`);
  return (
    <Panel>
      <ErrorOr state={state}>
        {(d) => (
          <>
            <DataTable caption="Moderation actions" rows={d.items} empty="No actions yet."
              columns={[
                { key: 'action', label: 'Action', render: (a) => <span className="capitalize text-ink">{human(a.action)}</span> },
                { key: 'reason', label: 'Reason', render: (a) => <span className="line-clamp-2">{a.reason}</span> },
                { key: 'target', label: 'Member', render: (a) => a.target_user_id ? <Link className="text-burgundy-600 hover:underline" href={`/admin/users/${a.target_user_id}`}>View</Link> : '—' },
                { key: 'expires', label: 'Expires', render: (a) => fmtDateTime(a.expires_at), hideOnMobile: true },
                { key: 'created', label: 'When', render: (a) => fmtDateTime(a.created_at) },
              ]} />
            <Pager page={d.page} pages={d.pages} total={d.total} onPage={setPage} />
          </>
        )}
      </ErrorOr>
    </Panel>
  );
}
