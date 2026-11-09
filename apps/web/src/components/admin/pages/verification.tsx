'use client';
import * as React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { VERIFICATION_KIND_LABELS, type VerificationKind } from '@2k/shared';
import { Button, Field, Notice, Textarea } from '@/components/ui';
import { AdminHeader, DataTable, Drawer, ErrorOr, FilterSelect, KeyValues, Pager, Panel, StatusBadge, fmtDateTime, human, mutate, qs, useAdminData, type Paged } from '../kit';

interface Row { id: string; profile_id: string; kind: string; status: string; provider: string; document_type: string | null; attempt: number; created_at: string; profileCode: string | null; name: string | null; ageHours: number }
interface Detail {
  verification: { id: string; kind: string; status: string; provider: string; document_type: string | null; submitted_data: Record<string, string>; rejection_reason: string | null; attempt: number; created_at: string; profiles: { id: string; profile_code: string; first_name: string | null; last_name: string | null; date_of_birth: string | null; gender: string | null; current_city: string | null; is_identity_verified: boolean } };
  events: { id: number; from_status: string | null; to_status: string; note: string | null; created_at: string }[];
  documents: { path: string; url: string | null }[];
  canSeeDocuments: boolean;
  primaryPhotoUrl: string | null;
}

export function VerificationPage() {
  const [f, setF] = React.useState({ status: 'open', kind: '', page: 1 });
  const state = useAdminData<Paged<Row>>(`/admin/verification${qs(f)}`);
  const [openId, setOpenId] = React.useState<string | null>(null);
  return (
    <>
      <AdminHeader title="Verification queue" description="Oldest first. Approving a government ID or photo check adds the matching badge; everything else on a profile remains a self-declared claim." />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterSelect label="Status" value={f.status} onChange={(status) => setF({ ...f, status, page: 1 })} options={[['open', 'Open (pending + in review)'], ['pending', 'Pending'], ['in_review', 'In review'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['resubmission_required', 'Resubmission required']]} />
          <FilterSelect label="Kind" value={f.kind} onChange={(kind) => setF({ ...f, kind, page: 1 })} options={[['', 'All kinds'], ...Object.entries(VERIFICATION_KIND_LABELS)]} />
        </div>
        <ErrorOr state={state}>
          {(d) => (
            <>
              <DataTable<Row> caption="Verification submissions" rows={d.items} onRowClick={(r) => setOpenId(r.id)} empty="No submissions waiting."
                columns={[
                  { key: 'member', label: 'Member', render: (r) => <span><span className="font-mono text-xs">{r.profileCode}</span> <span className="text-ink">{r.name}</span></span> },
                  { key: 'kind', label: 'Check', render: (r) => VERIFICATION_KIND_LABELS[r.kind as VerificationKind] ?? r.kind },
                  { key: 'doc', label: 'Document', render: (r) => human(r.document_type), hideOnMobile: true },
                  { key: 'attempt', label: 'Attempt', render: (r) => r.attempt, hideOnMobile: true },
                  { key: 'age', label: 'Waiting', render: (r) => <span className={r.ageHours > 48 ? 'font-medium text-danger' : ''}>{r.ageHours < 24 ? `${r.ageHours}h` : `${Math.floor(r.ageHours / 24)}d`}</span> },
                  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                ]} />
              <Pager page={d.page} pages={d.pages} total={d.total} onPage={(page) => setF({ ...f, page })} />
            </>
          )}
        </ErrorOr>
      </Panel>
      <Drawer open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} title="Review verification">
        {openId && <VerificationDetail id={openId} onDecided={() => { setOpenId(null); state.reload(); }} />}
      </Drawer>
    </>
  );
}

function VerificationDetail({ id, onDecided }: { id: string; onDecided: () => void }) {
  const state = useAdminData<Detail>(`/admin/verification/${id}`);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const decide = async (decision: string) => {
    setBusy(decision);
    const r = await mutate(`/admin/verification/${id}/decision`, 'POST', { decision, reason: reason.trim() || undefined }, 'Decision recorded');
    setBusy(null);
    if (r) onDecided();
  };
  return (
    <ErrorOr state={state}>
      {(d) => {
        const v = d.verification;
        const p = v.profiles;
        const open = ['pending', 'in_review'].includes(v.status);
        return (
          <div className="space-y-5">
            <KeyValues items={[
              ['Member', <Link key="m" className="text-burgundy-600 hover:underline" href={`/admin/profiles/${p.id}`}>{p.profile_code} · {[p.first_name, p.last_name].filter(Boolean).join(' ')}</Link>],
              ['Check', VERIFICATION_KIND_LABELS[v.kind as VerificationKind] ?? v.kind], ['Document type', human(v.document_type)], ['Provider', v.provider],
              ['Declared date of birth', p.date_of_birth], ['City', p.current_city], ['Status', <StatusBadge key="s" status={v.status} />], ['Submitted', fmtDateTime(v.created_at)],
              ...Object.entries(v.submitted_data ?? {}).map(([k, val]) => [human(k), val] as [string, React.ReactNode]),
            ]} />
            {d.canSeeDocuments ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Documents <span className="font-normal text-muted">(links expire in 10 minutes; this view is audited)</span></h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {d.documents.map((doc) => doc.url ? (
                    doc.path.endsWith('.pdf')
                      ? <a key={doc.path} href={doc.url} target="_blank" rel="noreferrer" className="rounded-lg border border-line p-4 text-sm text-burgundy-600 hover:underline">Open PDF document</a>
                      // eslint-disable-next-line @next/next/no-img-element
                      : <a key={doc.path} href={doc.url} target="_blank" rel="noreferrer"><img src={doc.url} alt="Submitted verification document" className="w-full rounded-lg border border-line" /></a>
                  ) : <p key={doc.path} className="text-sm text-muted">Document file missing.</p>)}
                  {d.primaryPhotoUrl && (
                    <figure>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.primaryPhotoUrl} alt="Member's primary profile photo for comparison" className="w-full rounded-lg border border-line" />
                      <figcaption className="mt-1 text-xs text-muted">Primary profile photo</figcaption>
                    </figure>
                  )}
                </div>
              </div>
            ) : (
              <Notice tone="warning"><ShieldAlert className="mr-1 inline h-4 w-4" />Viewing documents requires the sensitive data permission.</Notice>
            )}
            {d.events.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">History</h3>
                <ol className="space-y-1 text-sm text-ink-2">{d.events.map((e) => <li key={e.id}>{fmtDateTime(e.created_at)} — {human(e.from_status)} → <span className="font-medium">{human(e.to_status)}</span>{e.note ? `: ${e.note}` : ''}</li>)}</ol>
              </div>
            )}
            {open && (
              <div className="space-y-3 border-t border-line pt-4">
                <Field label="Reason or note" htmlFor="v-reason" hint="Required for rejection or resubmission. The member sees this.">
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-20" />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => decide('approved')} loading={busy === 'approved'}>Approve</Button>
                  <Button variant="secondary" disabled={reason.trim().length < 5} onClick={() => decide('resubmission_required')} loading={busy === 'resubmission_required'}>Request resubmission</Button>
                  <Button variant="danger" disabled={reason.trim().length < 5} onClick={() => decide('rejected')} loading={busy === 'rejected'}>Reject</Button>
                  {v.status === 'pending' && <Button variant="ghost" onClick={() => decide('in_review')} loading={busy === 'in_review'}>Mark in review</Button>}
                </div>
              </div>
            )}
            {v.rejection_reason && <Notice tone="warning">Last reason: {v.rejection_reason}</Notice>}
          </div>
        );
      }}
    </ErrorOr>
  );
}
