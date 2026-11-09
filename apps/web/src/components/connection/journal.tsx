'use client';
import * as React from 'react';
import { Check, Trash2 } from 'lucide-react';
import { JOURNAL_KINDS, JOURNAL_KIND_LABELS, relativeTime, type JournalEntry, type JournalKind } from '@2k/shared';
import { Button, ChipGroup, ErrorState, NativeSelect, Notice, Skeleton, Textarea } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';

const kindOptions = JOURNAL_KINDS.map((k) => ({ value: k, label: JOURNAL_KIND_LABELS[k] }));

/** Private timeline of how understanding of a connection evolves. Never reads messages. */
export function Journal({ connectionId }: { connectionId: string }) {
  const [entries, setEntries] = React.useState<JournalEntry[] | null>(null);
  const [kind, setKind] = React.useState<JournalKind>('topic_discussed');
  const [content, setContent] = React.useState('');
  const [filter, setFilter] = React.useState<JournalKind[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<JournalEntry[]>(`/connections/${connectionId}/journal`).then(setEntries).catch((e) => { setError(e instanceof ApiClientError ? e.message : 'Could not load.'); setEntries([]); });
  }, [connectionId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const entry = await api<JournalEntry>(`/connections/${connectionId}/journal`, { body: { kind, content: content.trim() } });
      setEntries((xs) => [entry, ...(xs ?? [])]);
      setContent('');
    } catch (err) { setError(err instanceof ApiClientError ? err.message : 'Could not save.'); }
    finally { setBusy(false); }
  };
  const toggle = async (en: JournalEntry) => {
    const u = await api<JournalEntry>(`/connections/${connectionId}/journal/${en.id}`, { method: 'PATCH', body: { resolved: !en.resolved } });
    setEntries((xs) => xs!.map((x) => (x.id === en.id ? u : x)));
  };
  const remove = async (en: JournalEntry) => {
    await api(`/connections/${connectionId}/journal/${en.id}`, { method: 'DELETE' });
    setEntries((xs) => xs!.filter((x) => x.id !== en.id));
  };

  if (!entries) return <Skeleton className="h-48 w-full" />;
  const shown = filter.length ? entries.filter((e) => filter.includes(e.kind)) : entries;
  const open = entries.filter((e) => e.kind === 'question_remaining' && !e.resolved).length;
  return (
    <div className="space-y-6">
      <Notice>Only you can see this journal. It never reads your messages and never changes compatibility scores.</Notice>
      {error && <ErrorState message={error} />}
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-[14rem_1fr]">
        <label className="sr-only" htmlFor="j-kind">Entry type</label>
        <NativeSelect id="j-kind" value={kind} onChange={(e) => setKind(e.target.value as JournalKind)}>{kindOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
        <label className="sr-only" htmlFor="j-text">What did you learn?</label>
        <Textarea id="j-text" className="min-h-12" maxLength={1000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="e.g. We talked about where we’d like to live — both open to Pune." />
        <Button type="submit" className="sm:col-start-2 sm:justify-self-end" disabled={!content.trim()} loading={busy}>Add entry</Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChipGroup label="Filter entries" multiple options={kindOptions} value={filter} onChange={setFilter} />
        {open > 0 && <p className="text-sm text-muted">{open} question{open === 1 ? '' : 's'} still to discuss</p>}
      </div>
      <ol className="relative space-y-4 border-l border-line pl-6">
        {shown.map((en) => (
          <li key={en.id} className="relative">
            <span className={cn('absolute -left-[1.85rem] top-1.5 h-3 w-3 rounded-full border-2 border-surface', en.resolved ? 'bg-success' : 'bg-champagne-400')} aria-hidden />
            <div className="flex items-start justify-between gap-3 rounded-xl bg-surface p-4 shadow-soft">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{JOURNAL_KIND_LABELS[en.kind]} · {relativeTime(en.createdAt)}</p>
                <p className={cn('mt-1 text-[0.95rem] text-ink', en.resolved && 'text-muted line-through')}>{en.content}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => toggle(en)} aria-pressed={en.resolved} aria-label={en.resolved ? 'Mark unresolved' : 'Mark resolved'} className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-success"><Check className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(en)} aria-label="Delete entry" className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="text-sm text-muted">No entries yet.</li>}
      </ol>
    </div>
  );
}
