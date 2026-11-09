'use client';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Heart, Inbox, Send } from 'lucide-react';
import { relativeTime, type InterestItem, type InterestStatus } from '@2k/shared';
import { Avatar, Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { CompatibilityChip, VerifiedBadges } from '@/components/profile/badges';
import { api, apiRaw } from '@/lib/api';
import { showApiError } from '@/components/discovery/hooks';

type Tab = 'received' | 'sent' | 'history';

const STATUS_COPY: Record<InterestStatus, { label: string; tone: 'success' | 'neutral' | 'warning' | 'outline' }> = {
  pending: { label: 'Awaiting response', tone: 'warning' },
  accepted: { label: 'Connected', tone: 'success' },
  declined: { label: 'Not a match right now', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'outline' },
  expired: { label: 'Expired', tone: 'outline' },
};

function InterestRow({ item, onChange }: { item: InterestItem; onChange: (i: InterestItem) => void }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const p = item.profile;
  const act = async (action: 'accept' | 'decline' | 'withdraw') => {
    setBusy(action);
    try {
      const r = await api<{ status: InterestStatus; conversationId: string | null; connectionId: string | null }>(`/interests/${item.id}`, { body: { action } });
      onChange({ ...item, status: r.status, respondedAt: new Date().toISOString(), profile: { ...p, relationship: { ...p.relationship, conversationId: r.conversationId ?? p.relationship.conversationId, connectionId: r.connectionId ?? p.relationship.connectionId } } });
      toast.success(action === 'accept' ? `You and ${p.displayName} are now connected.` : action === 'decline' ? 'Declined. They won’t be told directly.' : 'Interest withdrawn.');
    } catch (e) { showApiError(e); } finally { setBusy(null); }
  };
  const status = STATUS_COPY[item.status];
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-soft sm:flex-row sm:items-center">
      <Link href={`/app/profile/${p.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <Avatar src={p.photoUrl} name={p.displayName} blurred={p.photoBlurred} className="h-16 w-16" />
        <div className="min-w-0">
          <p className="truncate font-serif text-xl">{p.displayName}{p.age !== null && <span className="text-ink-2">, {p.age}</span>}</p>
          <p className="truncate text-sm text-muted">{[p.city, p.profession].filter(Boolean).join(' · ')}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2"><CompatibilityChip compatibility={p.compatibility} /><VerifiedBadges verified={p.verified} /></div>
        </div>
      </Link>
      <div className="flex flex-col gap-2 sm:w-72">
        {item.message && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm italic text-ink-2">“{item.message}”</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted">{item.direction === 'received' ? 'Received' : 'Sent'} {relativeTime(item.createdAt)}</span>
          {item.status === 'pending' && item.direction === 'received' ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" loading={busy === 'decline'} onClick={() => act('decline')}>Decline</Button>
              <Button size="sm" loading={busy === 'accept'} onClick={() => act('accept')}><Heart />Accept</Button>
            </div>
          ) : item.status === 'pending' ? (
            <Button size="sm" variant="ghost" loading={busy === 'withdraw'} onClick={() => act('withdraw')}>Withdraw</Button>
          ) : item.status === 'accepted' && p.relationship.conversationId ? (
            <Button size="sm" asChild><Link href={`/app/messages/${p.relationship.conversationId}`}>Message</Link></Button>
          ) : (
            <Badge tone={status.tone}>{status.label}</Badge>
          )}
        </div>
      </div>
    </li>
  );
}

function InterestList({ tab }: { tab: Tab }) {
  const [items, setItems] = React.useState<InterestItem[] | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [more, setMore] = React.useState(false);
  const path = React.useCallback((c?: string | null) => {
    const q = new URLSearchParams(tab === 'history' ? { direction: 'all' } : { direction: tab, status: 'pending' });
    if (c) q.set('cursor', c);
    return `/interests?${q}`;
  }, [tab]);
  const load = React.useCallback(async () => {
    setError(null);
    try {
      const r = await apiRaw<InterestItem[]>(path());
      setItems(tab === 'history' ? r.data.filter((i) => i.status !== 'pending') : r.data);
      setCursor(r.nextCursor ?? null);
    } catch { setError('Could not load interests.'); }
  }, [path, tab]);
  React.useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    setMore(true);
    try {
      const r = await apiRaw<InterestItem[]>(path(cursor));
      setItems((cur) => [...(cur ?? []), ...(tab === 'history' ? r.data.filter((i) => i.status !== 'pending') : r.data)]);
      setCursor(r.nextCursor ?? null);
    } catch (e) { showApiError(e); } finally { setMore(false); }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (items.length === 0) {
    const copy = {
      received: { icon: <Inbox />, title: 'No new interests', description: 'When someone expresses interest in you, it will appear here for you to consider in your own time.' },
      sent: { icon: <Send />, title: 'No pending interests', description: 'Interests you send will wait here until they respond.' },
      history: { icon: <Heart />, title: 'Nothing here yet', description: 'Responded, withdrawn and expired interests appear here.' },
    }[tab];
    return <EmptyState {...copy} action={tab !== 'history' ? <Button variant="secondary" asChild><Link href="/app">See today’s introductions</Link></Button> : undefined} />;
  }
  return (
    <>
      <ul className="space-y-3">{items.map((i) => <InterestRow key={i.id} item={i} onChange={(n) => setItems((cur) => cur!.map((x) => (x.id === n.id ? n : x)))} />)}</ul>
      {cursor && <div className="mt-6 flex justify-center"><Button variant="secondary" loading={more} onClick={loadMore}>Show more</Button></div>}
    </>
  );
}

export function InterestsView() {
  const [tab, setTab] = React.useState<Tab>('received');
  return (
    <div>
      <PageHeader eyebrow="Interests" title="Interests" description="Respond when you’re ready. Declining is private — the other person simply sees that it isn’t a match right now." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList aria-label="Interest lists">
          <TabsTrigger value="received">Received</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="received"><InterestList tab="received" /></TabsContent>
        <TabsContent value="sent"><InterestList tab="sent" /></TabsContent>
        <TabsContent value="history"><InterestList tab="history" /></TabsContent>
      </Tabs>
    </div>
  );
}
