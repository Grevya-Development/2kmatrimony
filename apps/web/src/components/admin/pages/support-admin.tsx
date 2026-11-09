'use client';
import * as React from 'react';
import Link from 'next/link';
import { Button, Field, NativeSelect, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminHeader, DataTable, Drawer, ErrorOr, FilterSelect, Pager, Panel, StatusBadge, fmtDateTime, human, mutate, qs, useAdminData, useCan, type Paged } from '../kit';

interface Ticket { id: string; subject: string; category: string; status: string; priority: string; assigned_to: string | null; assignedToMe: boolean; updated_at: string; created_at: string }
interface TicketDetail {
  ticket: { id: string; subject: string; category: string; status: string; priority: string; assigned_to: string | null; created_at: string };
  messages: { id: string; body: string; is_staff: boolean; is_internal_note: boolean; created_at: string }[];
  member: { id: string; full_name: string | null; status: string; profile: { id: string; profile_code: string } | null } | null;
}

export function SupportAdminPage() {
  const [f, setF] = React.useState({ status: 'active', category: '', mine: false, page: 1 });
  const state = useAdminData<Paged<Ticket>>(`/admin/support/tickets${qs(f)}`);
  const [openId, setOpenId] = React.useState<string | null>(null);
  return (
    <>
      <AdminHeader title="Support" description="Member requests. Internal notes are never visible to members." />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FilterSelect label="Status" value={f.status} onChange={(status) => setF({ ...f, status, page: 1 })} options={[['active', 'Active'], ['open', 'Open'], ['pending_user', 'Waiting on member'], ['resolved', 'Resolved'], ['closed', 'Closed'], ['all', 'All']]} />
          <FilterSelect label="Category" value={f.category} onChange={(category) => setF({ ...f, category, page: 1 })} options={[['', 'All categories'], ...['account', 'billing', 'verification', 'safety', 'technical', 'feedback', 'other'].map((c) => [c, human(c)] as [string, string])]} />
          <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" checked={f.mine} onChange={(e) => setF({ ...f, mine: e.target.checked, page: 1 })} className="h-4 w-4 accent-burgundy-600" />Assigned to me</label>
        </div>
        <ErrorOr state={state}>
          {(d) => (
            <>
              <DataTable<Ticket> caption="Support tickets" rows={d.items} onRowClick={(t) => setOpenId(t.id)} empty="No tickets in this view."
                columns={[
                  { key: 'subject', label: 'Subject', render: (t) => <span className="text-ink">{t.subject}</span> },
                  { key: 'category', label: 'Category', render: (t) => <span className="capitalize">{human(t.category)}</span>, hideOnMobile: true },
                  { key: 'priority', label: 'Priority', render: (t) => <StatusBadge status={t.priority} /> },
                  { key: 'status', label: 'Status', render: (t) => <StatusBadge status={t.status} /> },
                  { key: 'assignee', label: 'Assignee', render: (t) => (t.assignedToMe ? 'Me' : t.assigned_to ? 'Someone' : '—'), hideOnMobile: true },
                  { key: 'updated', label: 'Updated', render: (t) => fmtDateTime(t.updated_at) },
                ]} />
              <Pager page={d.page} pages={d.pages} total={d.total} onPage={(page) => setF({ ...f, page })} />
            </>
          )}
        </ErrorOr>
      </Panel>
      <Drawer open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} title="Support ticket">
        {openId && <TicketPanel id={openId} onChanged={state.reload} />}
      </Drawer>
    </>
  );
}

function TicketPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const state = useAdminData<TicketDetail>(`/admin/support/tickets/${id}`);
  const can = useCan();
  const [body, setBody] = React.useState('');
  const [internal, setInternal] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const refresh = () => { state.reload(); onChanged(); };
  const patch = async (b: Record<string, unknown>, msg: string) => { if (await mutate(`/admin/support/tickets/${id}`, 'PATCH', b, msg)) refresh(); };
  return (
    <ErrorOr state={state}>
      {(d) => (
        <div className="space-y-5">
          <div>
            <h3 className="font-serif text-2xl">{d.ticket.subject}</h3>
            <p className="mt-1 text-sm text-muted">
              {human(d.ticket.category)} · opened {fmtDateTime(d.ticket.created_at)} ·{' '}
              {d.member ? <Link className="text-burgundy-600 hover:underline" href={`/admin/users/${d.member.id}`}>{d.member.full_name ?? d.member.profile?.profile_code ?? 'Member'}</Link> : 'Deleted account'}
            </p>
          </div>
          {can('support.respond') && (
            <div className="flex flex-wrap gap-2">
              {!d.ticket.assigned_to && <Button size="sm" variant="secondary" onClick={() => patch({ assignToMe: true }, 'Assigned to you')}>Assign to me</Button>}
              <NativeSelect aria-label="Status" className="h-9 w-auto text-sm" value={d.ticket.status} onChange={(e) => patch({ status: e.target.value }, 'Status updated')}>
                {['open', 'pending_user', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{human(s)}</option>)}
              </NativeSelect>
              <NativeSelect aria-label="Priority" className="h-9 w-auto text-sm" value={d.ticket.priority} onChange={(e) => patch({ priority: e.target.value }, 'Priority updated')}>
                {['low', 'normal', 'high', 'urgent'].map((s) => <option key={s} value={s}>{human(s)} priority</option>)}
              </NativeSelect>
            </div>
          )}
          <ol className="space-y-3" aria-label="Conversation">
            {d.messages.map((m) => (
              <li key={m.id} className={cn('rounded-xl p-3 text-sm', m.is_internal_note ? 'border border-dashed border-warning/40 bg-warning-bg' : m.is_staff ? 'ml-8 bg-burgundy-50' : 'mr-8 bg-surface-2')}>
                <p className="mb-1 text-xs text-muted">{m.is_internal_note ? 'Internal note' : m.is_staff ? 'Staff' : 'Member'} · {fmtDateTime(m.created_at)}</p>
                <p className="whitespace-pre-line text-ink">{m.body}</p>
              </li>
            ))}
          </ol>
          {can('support.respond') && (
            <form className="space-y-3 border-t border-line pt-4" onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const ok = await mutate(`/admin/support/tickets/${id}`, 'POST', { body: body.trim(), internal }, internal ? 'Note added' : 'Reply sent');
              setBusy(false);
              if (ok) { setBody(''); refresh(); }
            }}>
              <Field label={internal ? 'Internal note (staff only)' : 'Reply to member'} htmlFor="ticket-reply"><Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-28" /></Field>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-4 w-4 accent-burgundy-600" />Internal note</label>
                <Button type="submit" disabled={!body.trim()} loading={busy}>{internal ? 'Add note' : 'Send reply'}</Button>
              </div>
            </form>
          )}
        </div>
      )}
    </ErrorOr>
  );
}
