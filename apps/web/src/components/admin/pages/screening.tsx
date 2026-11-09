'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Checkbox, EmptyState, Label, Textarea } from '@/components/ui';
import { UserCheck } from 'lucide-react';
import { AdminHeader, DataTable, ErrorOr, Panel, human, mutate, useAdminData } from '../kit';

interface Item {
  profileId: string; profileCode: string; name: string; createdFor: string; gender: string | null; age: number | null; city: string | null;
  completionPct: number; submittedAt: string | null; waitingHours: number; overdue: boolean; pendingPhotos: number; photoUrl: string | null;
}

const waiting = (h: number) => (h < 1 ? 'Just now' : h < 48 ? `${h}h` : `${Math.round(h / 24)}d`);

export function ScreeningPage() {
  const state = useAdminData<{ items: Item[]; slaHours: number }>('/admin/screening');
  const router = useRouter();
  return (
    <>
      <AdminHeader title="Screening" description="Every new profile is reviewed by a person before it goes live. Oldest first." />
      <ErrorOr state={state} rows={6}>
        {({ items, slaHours }) => items.length === 0 ? (
          <EmptyState icon={<UserCheck />} title="All caught up" description="No profiles are waiting for review right now." />
        ) : (
          <Panel description={`Target: review within ${slaHours} hours of submission.`}>
            <DataTable caption="Profiles awaiting review" rowKey={(r) => r.profileId} rows={items} onRowClick={(r) => router.push(`/admin/profiles/${r.profileId}`)}
              columns={[
                { key: 'name', label: 'Member', render: (r) => (
                  <span className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.photoUrl ? <img src={r.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="h-9 w-9 rounded-full bg-surface-2" />}
                    <span><span className="block font-medium text-ink">{r.name}</span><span className="text-xs text-muted">{r.profileCode}</span></span>
                  </span>
                ) },
                { key: 'who', label: 'Created for', render: (r) => <span className="capitalize">{human(r.createdFor)}</span>, hideOnMobile: true },
                { key: 'about', label: 'Age · city', render: (r) => [r.age, r.city].filter(Boolean).join(' · ') || '—', hideOnMobile: true },
                { key: 'completion', label: 'Complete', render: (r) => `${r.completionPct}%`, hideOnMobile: true },
                { key: 'photos', label: 'Photos to check', render: (r) => (r.pendingPhotos ? <Badge tone="warning">{r.pendingPhotos} pending</Badge> : '—') },
                { key: 'waiting', label: 'Waiting', render: (r) => <Badge tone={r.overdue ? 'danger' : 'neutral'}>{waiting(r.waitingHours)}</Badge> },
              ]} />
          </Panel>
        )}
      </ErrorOr>
    </>
  );
}

/** Approve / request changes — shown on the admin profile view while a profile is in review. */
export function ScreeningActions({ profileId, onDone }: { profileId: string; onDone: () => void }) {
  const [note, setNote] = React.useState('');
  const [approvePhotos, setApprovePhotos] = React.useState(true);
  const [busy, setBusy] = React.useState<'approve' | 'changes' | null>(null);
  const decide = async (body: object, kind: 'approve' | 'changes', message: string) => {
    setBusy(kind);
    const r = await mutate(`/admin/screening/${profileId}`, 'POST', body, message);
    setBusy(null);
    if (r) onDone();
  };
  return (
    <Panel title="Screening decision" description="This profile is waiting for review. The member is notified either way." className="mb-4 border-gold-200 bg-gold-50/60">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={approvePhotos} onCheckedChange={(v) => setApprovePhotos(v === true)} />Also approve the photos I’ve checked</label>
          <Button loading={busy === 'approve'} onClick={() => void decide({ action: 'approve', approvePhotos }, 'approve', 'Profile approved — now live')}>Approve and publish</Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="screening-note">Request changes</Label>
          <Textarea id="screening-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please add a clear photo of yourself and a few lines about your family." className="min-h-24" />
          <Button variant="secondary" loading={busy === 'changes'} disabled={note.trim().length < 10} onClick={() => void decide({ action: 'request_changes', note: note.trim() }, 'changes', 'Changes requested')}>Send back with note</Button>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted"><Link href="/admin/screening" className="underline underline-offset-2">Back to the queue</Link></p>
    </Panel>
  );
}
