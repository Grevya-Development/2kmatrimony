'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { relativeTime, type NotificationItem } from '@2k/shared';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { useMe } from '@/components/shell/me-context';
import { api, apiRaw } from '@/lib/api';
import { subscribeWhenReady } from '@/lib/supabase/browser';
import { showApiError } from '@/components/discovery/hooks';
import { cn } from '@/lib/utils';

export function NotificationsView() {
  const router = useRouter();
  const { me, refresh } = useMe();
  const [items, setItems] = React.useState<NotificationItem[] | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try { const r = await apiRaw<NotificationItem[]>('/notifications?limit=30'); setItems(r.data); setCursor(r.nextCursor ?? null); }
    catch { setError('Could not load notifications.'); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    return subscribeWhenReady((sb) => sb.channel(`notifications-page:${me.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.user.id}` }, (payload) => {
        const n = payload.new as { id: string; type: string; title: string; body: string | null; data: Record<string, unknown> | null; read_at: string | null; created_at: string };
        setItems((cur) => (cur?.some((x) => x.id === n.id) ? cur : [{ id: n.id, type: n.type, title: n.title, body: n.body, data: n.data ?? {}, readAt: n.read_at, createdAt: n.created_at }, ...(cur ?? [])]));
      })
      .subscribe());
  }, [me.user.id]);

  const markAll = async () => {
    setBusy(true);
    try { await api('/notifications/read', { body: {} }); setItems((cur) => cur?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null); await refresh(); }
    catch (e) { showApiError(e); } finally { setBusy(false); }
  };

  const open = async (n: NotificationItem) => {
    if (!n.readAt) {
      setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? null);
      void api('/notifications/read', { body: { ids: [n.id] } }).then(() => refresh()).catch(() => undefined);
    }
    const href = typeof n.data.href === 'string' && n.data.href.startsWith('/') ? n.data.href : null;
    if (href) router.push(href);
  };

  const loadMore = async () => {
    if (!cursor) return;
    try { const r = await apiRaw<NotificationItem[]>(`/notifications?limit=30&cursor=${cursor}`); setItems((cur) => [...(cur ?? []), ...r.data]); setCursor(r.nextCursor ?? null); }
    catch (e) { showApiError(e); }
  };

  const unread = items?.filter((n) => !n.readAt).length ?? 0;
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Notifications" title="Notifications" actions={unread > 0 ? <Button variant="secondary" size="sm" loading={busy} onClick={markAll}><CheckCheck />Mark all as read</Button> : undefined} />
      {error ? <ErrorState message={error} onRetry={load} />
        : !items ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        : items.length === 0 ? <EmptyState icon={<Bell />} title="You’re all caught up" description="Interests, connections and important account updates will appear here." />
        : (
          <>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => open(n)} className={cn('flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2', !n.readAt && 'bg-burgundy-50/40')}>
                    <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-burgundy-600')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[0.95rem]', !n.readAt && 'font-medium')}>{n.title}{!n.readAt && <span className="sr-only"> (unread)</span>}</span>
                      {n.body && <span className="mt-0.5 block whitespace-pre-line text-sm text-muted">{n.body}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{relativeTime(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {cursor && <div className="mt-6 flex justify-center"><Button variant="secondary" onClick={loadMore}>Show older</Button></div>}
          </>
        )}
    </div>
  );
}
