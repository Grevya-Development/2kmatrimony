'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BellOff, MessagesSquare } from 'lucide-react';
import { relativeTime, type ConversationItem } from '@2k/shared';
import { Avatar, Button, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { apiRaw } from '@/lib/api';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

export function ConversationList({ className }: { className?: string }) {
  const pathname = usePathname();
  const [items, setItems] = React.useState<ConversationItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [archived, setArchived] = React.useState(false);

  const load = React.useCallback(async () => {
    try { setItems((await apiRaw<ConversationItem[]>(`/conversations${archived ? '?archived=1' : ''}`)).data); setError(null); }
    catch { setError('Could not load conversations.'); }
  }, [archived]);
  React.useEffect(() => { void load(); }, [load]);

  // Refresh previews/unread counts when any of my conversations change (RLS-scoped).
  React.useEffect(() => {
    const sb = supabaseBrowser();
    let t: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => { clearTimeout(t); t = setTimeout(() => void load(), 400); };
    const ch = sb.channel('conversation-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, debounced)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants' }, debounced)
      .subscribe();
    return () => { clearTimeout(t); void sb.removeChannel(ch); };
  }, [load]);

  return (
    <nav aria-label="Conversations" className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center justify-between pb-4">
        <h1 className="font-serif text-3xl">Messages</h1>
        <button type="button" onClick={() => setArchived((a) => !a)} className="text-sm text-muted hover:text-ink" aria-pressed={archived}>{archived ? 'Hide archived' : 'Show archived'}</button>
      </div>
      {error ? <ErrorState message={error} onRetry={load} />
        : !items ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        : items.length === 0 ? <EmptyState icon={<MessagesSquare />} title="No conversations yet" description="Messaging opens once an interest becomes mutual." action={<Button variant="secondary" asChild><Link href="/app/interests">Review interests</Link></Button>} />
        : (
          <ul className="-mx-2 space-y-1 overflow-y-auto">
            {items.map((c) => {
              const active = pathname === `/app/messages/${c.id}`;
              return (
                <li key={c.id}>
                  <Link href={`/app/messages/${c.id}`} aria-current={active ? 'page' : undefined}
                    className={cn('flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors', active ? 'bg-surface shadow-soft' : 'hover:bg-surface/70')}>
                    <Avatar src={c.other.photoUrl} name={c.other.displayName} className="h-12 w-12" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn('truncate', c.unreadCount ? 'font-semibold' : 'font-medium')}>{c.other.displayName}</span>
                        {c.lastMessageAt && <span className="shrink-0 text-xs text-muted">{relativeTime(c.lastMessageAt)}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={cn('truncate text-sm', c.unreadCount ? 'text-ink' : 'text-muted')}>{c.isLocked ? 'Conversation closed' : c.lastMessagePreview ?? 'Say hello'}</span>
                        {c.muted && <BellOff className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Muted" />}
                        {c.unreadCount > 0 && <span className="ml-auto rounded-full bg-burgundy-600 px-1.5 text-[0.7rem] font-medium text-white" aria-label={`${c.unreadCount} unread`}>{c.unreadCount}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
    </nav>
  );
}
