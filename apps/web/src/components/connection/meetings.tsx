'use client';
import * as React from 'react';
import { CalendarHeart, MapPin } from 'lucide-react';
import type { MeetingPlan } from '@2k/shared';
import { Badge, Button, ErrorState, Field, Input, Notice, Skeleton, Textarea } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';

const STATUS_TONE = { proposed: 'warning', accepted: 'success', declined: 'neutral', cancelled: 'neutral', completed: 'info' } as const;

export function Meetings({ connectionId, active, canRespond = true }: { connectionId: string; active: boolean; canRespond?: boolean }) {
  const [list, setList] = React.useState<MeetingPlan[] | null>(null);
  const [title, setTitle] = React.useState('Coffee');
  const [when, setWhen] = React.useState('');
  const [place, setPlace] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<MeetingPlan[]>(`/connections/${connectionId}/meetings`).then(setList).catch((e) => { setError(e instanceof ApiClientError ? e.message : 'Could not load.'); setList([]); });
  }, [connectionId]);

  const propose = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const m = await api<MeetingPlan>(`/connections/${connectionId}/meetings`, { body: { title: title.trim(), proposedAt: new Date(when).toISOString(), locationText: place.trim() || null, notes: notes.trim() || null } });
      setList((xs) => [m, ...(xs ?? [])]);
      setPlace(''); setNotes(''); setWhen('');
    } catch (err) { setError(err instanceof ApiClientError ? err.message : 'Could not propose.'); }
    finally { setBusy(false); }
  };
  const update = async (m: MeetingPlan, status: 'accepted' | 'declined' | 'cancelled' | 'completed') => {
    setError(null);
    try {
      const u = await api<MeetingPlan>(`/connections/${connectionId}/meetings/${m.id}`, { method: 'PATCH', body: { status } });
      setList((xs) => xs!.map((x) => (x.id === m.id ? u : x)));
    } catch (err) { setError(err instanceof ApiClientError ? err.message : 'Could not update.'); }
  };

  if (!list) return <Skeleton className="h-48 w-full" />;
  return (
    <div className="space-y-6">
      <Notice>For first meetings, choose a public place and let someone you trust know your plans.</Notice>
      {error && <ErrorState message={error} />}
      {active && (
        <form onSubmit={propose} className="grid gap-4 rounded-2xl border border-line p-5 sm:grid-cols-2">
          <Field label="What" htmlFor="mt-title"><Input maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
          <Field label="When" htmlFor="mt-when"><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required /></Field>
          <Field label="Where" htmlFor="mt-place" optional><Input maxLength={200} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="A café, park or restaurant" /></Field>
          <Field label="Note" htmlFor="mt-notes" optional><Textarea className="min-h-12" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Button type="submit" className="sm:col-span-2 sm:justify-self-end" loading={busy} disabled={!when || !title.trim()}>Propose meeting</Button>
        </form>
      )}
      <ul className="space-y-3">
        {list.map((m) => (
          <li key={m.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <CalendarHeart className="mt-1 h-5 w-5 shrink-0 text-champagne-600" aria-hidden />
              <div>
                <p className="font-medium text-ink">{m.title} <Badge tone={STATUS_TONE[m.status]} className="ml-1 align-middle">{m.status}</Badge></p>
                <p className="text-sm text-ink-2">{new Date(m.proposedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                {m.locationText && <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" aria-hidden />{m.locationText}</p>}
                {m.notes && <p className="text-sm text-muted">{m.notes}</p>}
                <p className="text-xs text-muted">{m.proposedByMe ? 'Proposed by you' : m.proposedByFamily ? 'Proposed by family' : 'Proposed by them'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canRespond && m.status === 'proposed' && !m.proposedByMe && <><Button size="sm" onClick={() => update(m, 'accepted')}>Accept</Button><Button size="sm" variant="secondary" onClick={() => update(m, 'declined')}>Decline</Button></>}
              {(m.status === 'proposed' || m.status === 'accepted') && (m.proposedByMe || canRespond) && <Button size="sm" variant="ghost" onClick={() => update(m, 'cancelled')}>Cancel</Button>}
              {canRespond && m.status === 'accepted' && <Button size="sm" variant="secondary" onClick={() => update(m, 'completed')}>Mark as met</Button>}
            </div>
          </li>
        ))}
        {list.length === 0 && <li className="text-center text-sm text-muted">No meetings planned yet.</li>}
      </ul>
    </div>
  );
}
