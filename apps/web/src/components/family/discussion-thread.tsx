'use client';
import * as React from 'react';
import { Send } from 'lucide-react';
import { relativeTime, type FamilyDiscussionItem } from '@2k/shared';
import { Button, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Private family discussion about one profile. `profileId` is the owner's profile (omit when the owner is viewing). */
export function DiscussionThread({ profileId, targetProfileId }: { profileId?: string; targetProfileId: string }) {
  const [items, setItems] = React.useState<FamilyDiscussionItem[] | null>(null);
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const qs = `targetProfileId=${targetProfileId}${profileId ? `&profileId=${profileId}` : ''}`;

  React.useEffect(() => {
    api<FamilyDiscussionItem[]>(`/family/discussions?${qs}`).then(setItems).catch((e) => { setError(e instanceof ApiClientError ? e.message : 'Could not load.'); setItems([]); });
  }, [qs]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setError(null);
    try {
      const item = await api<FamilyDiscussionItem>('/family/discussions', { body: { profileId, targetProfileId, body: body.trim() } });
      setItems((xs) => [...(xs ?? []), item]);
      setBody('');
    } catch (err) { setError(err instanceof ApiClientError ? err.message : 'Could not post.'); }
    finally { setBusy(false); }
  };

  if (!items) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="space-y-4">
      <ul className="max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
        {items.map((d) => (
          <li key={d.id} className={cn('rounded-2xl px-4 py-3 text-sm', d.isMine ? 'ml-6 bg-ink text-canvas' : 'mr-6 bg-surface-2 text-ink')}>
            <p className={cn('mb-1 text-xs', d.isMine ? 'text-canvas/70' : 'text-muted')}>{d.isMine ? 'You' : d.authorName}{d.isOwner && !d.isMine ? ' (profile owner)' : ''} · {relativeTime(d.createdAt)}</p>
            <p className="whitespace-pre-wrap">{d.body}</p>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted">No messages yet. Share your thoughts — only your family circle sees this.</li>}
      </ul>
      {error && <ErrorState message={error} />}
      <form onSubmit={post} className="flex gap-2">
        <label htmlFor={`disc-${targetProfileId}`} className="sr-only">Message</label>
        <input id={`disc-${targetProfileId}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Write a thought…"
          className="h-11 flex-1 rounded-xl border border-line bg-canvas px-4 text-sm focus:border-burgundy-500 focus:outline-none focus:ring-4 focus:ring-burgundy-100" />
        <Button type="submit" size="icon" aria-label="Post" loading={busy} disabled={!body.trim()}><Send /></Button>
      </form>
    </div>
  );
}
