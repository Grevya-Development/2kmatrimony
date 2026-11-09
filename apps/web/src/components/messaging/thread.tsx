'use client';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AlertCircle, ArrowLeft, Bell, BellOff, Archive, ImagePlus, Lock, MoreHorizontal, SendHorizontal, Sparkles } from 'lucide-react';
import type { ConversationItem, MessageItem } from '@2k/shared';
import { Avatar, Button, ErrorState, Skeleton, Spinner } from '@/components/ui';
import { useMe } from '@/components/shell/me-context';
import { ReportDialog } from '@/components/discovery/safety-dialogs';
import { showApiError } from '@/components/discovery/hooks';
import { api, apiRaw, newClientId, uploadToSignedUrl } from '@/lib/api';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

type Local = MessageItem & { pending?: boolean; failed?: boolean };
type Row = { id: string; conversation_id: string; sender_profile_id: string | null; kind: string; body: string | null; media_path: string | null; client_id: string | null; created_at: string; deleted_at: string | null };

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

function merge(cur: Local[], incoming: Local[]): Local[] {
  const out = [...cur];
  for (const m of incoming) {
    const i = out.findIndex((x) => x.id === m.id || (!!m.clientId && x.clientId === m.clientId));
    if (i >= 0) out[i] = { ...m, pending: false, failed: false };
    else out.push(m);
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function Thread({ conversationId }: { conversationId: string }) {
  const { me } = useMe();
  const myId = me.profile?.id ?? '';
  const [conv, setConv] = React.useState<ConversationItem | null>(null);
  const [messages, setMessages] = React.useState<Local[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [otherRead, setOtherRead] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [typing, setTyping] = React.useState(false);
  const [online, setOnline] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [reportMsg, setReportMsg] = React.useState<string | null>(null);
  const [reportMember, setReportMember] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const channelRef = React.useRef<ReturnType<ReturnType<typeof supabaseBrowser>['channel']> | null>(null);
  const lastTypingSent = React.useRef(0);
  const typingTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const markRead = React.useCallback(() => {
    if (document.visibilityState === 'visible') void api(`/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => undefined);
  }, [conversationId]);

  const loadLatest = React.useCallback(async () => {
    const r = await apiRaw<{ items: MessageItem[]; otherLastReadAt: string | null }>(`/conversations/${conversationId}/messages?limit=40`);
    setMessages((cur) => merge(cur, r.data.items));
    setOtherRead(r.data.otherLastReadAt);
    return r;
  }, [conversationId]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true); setMessages([]); setError(null);
    Promise.all([api<ConversationItem>(`/conversations/${conversationId}`), loadLatest()])
      .then(([c, r]) => { if (cancelled) return; setConv(c); setCursor(r.nextCursor ?? null); markRead(); })
      .catch(() => !cancelled && setError('This conversation isn’t available.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [conversationId, loadLatest, markRead]);

  // Realtime: new messages + read receipts (RLS-scoped postgres changes) and
  // a private channel for typing indicators and presence.
  React.useEffect(() => {
    if (!myId) return;
    const sb = supabaseBrowser();
    const changes = sb.channel(`messages:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const r = payload.new as Row;
        if (r.deleted_at) return;
        if (r.media_path) { void loadLatest(); }
        else setMessages((cur) => merge(cur, [{ id: r.id, conversationId: r.conversation_id, senderProfileId: r.sender_profile_id, kind: r.kind as MessageItem['kind'], body: r.body, mediaUrl: null, clientId: r.client_id, createdAt: r.created_at, isMine: r.sender_profile_id === myId }]));
        if (r.sender_profile_id !== myId) { setTyping(false); markRead(); }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const p = payload.new as { profile_id: string; last_read_at: string | null };
        if (p.profile_id !== myId && p.last_read_at) setOtherRead(p.last_read_at);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` }, (payload) => {
        const c = payload.new as { is_locked: boolean };
        setConv((cur) => (cur ? { ...cur, isLocked: c.is_locked } : cur));
      })
      .subscribe();

    let room: ReturnType<typeof sb.channel> | null = null;
    void sb.realtime.setAuth().then(() => {
      room = sb.channel(`conversation:${conversationId}`, { config: { private: true, presence: { key: myId } } })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if ((payload as { profileId?: string }).profileId === myId) return;
          setTyping(true);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTyping(false), 3500);
        })
        .on('presence', { event: 'sync' }, () => {
          const state = room!.presenceState();
          setOnline(Object.keys(state).some((k) => k !== myId));
        })
        .subscribe((status) => { if (status === 'SUBSCRIBED') void room!.track({ at: new Date().toISOString() }); });
      channelRef.current = room;
    });

    const onVisible = () => markRead();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(typingTimer.current);
      void sb.removeChannel(changes);
      if (room) void sb.removeChannel(room);
      channelRef.current = null;
    };
  }, [conversationId, myId, loadLatest, markRead]);

  React.useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const loadEarlier = async () => {
    if (!cursor) return;
    try {
      const r = await apiRaw<{ items: MessageItem[] }>(`/conversations/${conversationId}/messages?limit=40&cursor=${cursor}`);
      setMessages((cur) => merge(cur, r.data.items));
      setCursor(r.nextCursor ?? null);
    } catch (e) { showApiError(e); }
  };

  const sendTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000 || !channelRef.current) return;
    lastTypingSent.current = now;
    void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { profileId: myId } });
  };

  const deliver = async (local: Local, body: Record<string, unknown>) => {
    try {
      const saved = await api<MessageItem>(`/conversations/${conversationId}/messages`, { body });
      setMessages((cur) => merge(cur, [saved]));
    } catch (e) {
      setMessages((cur) => cur.map((m) => (m.clientId === local.clientId ? { ...m, pending: false, failed: true } : m)));
      showApiError(e);
    }
  };

  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const clientId = newClientId();
    const local: Local = { id: `local-${clientId}`, conversationId, senderProfileId: myId, kind: 'text', body: text, mediaUrl: null, clientId, createdAt: new Date().toISOString(), isMine: true, pending: true };
    setMessages((cur) => [...cur, local]);
    setDraft('');
    void deliver(local, { clientId, kind: 'text', body: text });
  };

  const retry = (m: Local) => {
    setMessages((cur) => cur.map((x) => (x.clientId === m.clientId ? { ...x, failed: false, pending: true } : x)));
    void deliver(m, { clientId: m.clientId, kind: 'text', body: m.body });
  };

  const sendImage = async (file: File) => {
    setUploading(true);
    try {
      const ticket = await api<{ path: string; signedUrl: string }>('/chat-uploads', { body: { conversationId, contentType: file.type, sizeBytes: file.size } });
      await uploadToSignedUrl(ticket.signedUrl, file);
      const saved = await api<MessageItem>(`/conversations/${conversationId}/messages`, { body: { clientId: newClientId(), kind: 'image', mediaPath: ticket.path } });
      setMessages((cur) => merge(cur, [saved]));
    } catch (e) { showApiError(e, 'Could not send the photo.'); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const patch = async (body: { muted?: boolean; archived?: boolean }) => {
    try {
      await api(`/conversations/${conversationId}`, { method: 'PATCH', body });
      setConv((c) => (c ? { ...c, ...body } : c));
      toast.success(body.muted !== undefined ? (body.muted ? 'Notifications muted for this conversation' : 'Notifications on') : body.archived ? 'Conversation archived' : 'Moved back to inbox');
    } catch (e) { showApiError(e); }
  };

  if (loading) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-[60dvh]" /></div>;
  if (error || !conv) return <ErrorState message={error ?? 'This conversation isn’t available.'} />;

  const other = conv.other;
  const lastMine = [...messages].reverse().find((m) => m.isMine && !m.pending && !m.failed);
  const seen = !!(lastMine && otherRead && otherRead >= lastMine.createdAt);
  let lastDay = '';

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-soft md:h-[calc(100dvh-9rem)]">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link href="/app/messages" className="rounded-full p-1.5 text-muted hover:bg-surface-2 lg:hidden" aria-label="Back to conversations"><ArrowLeft className="h-5 w-5" /></Link>
        <Link href={`/app/profile/${other.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="relative">
            <Avatar src={other.photoUrl} name={other.displayName} className="h-10 w-10" />
            {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-success" aria-label="Online now" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{other.displayName}</span>
            <span className="block text-xs text-muted" aria-live="polite">{typing ? 'typing…' : online ? 'Online' : other.city ?? ''}</span>
          </span>
        </Link>
        <Button variant="secondary" size="sm" asChild className="hidden sm:inline-flex"><Link href={`/app/connections/${conv.connectionId}`}><Sparkles />Connection space</Link></Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Conversation options"><MoreHorizontal /></Button></DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" className="z-50 min-w-52 rounded-xl border border-line bg-surface p-1.5 shadow-lift">
              <DropdownMenu.Item asChild><Link href={`/app/connections/${conv.connectionId}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2 sm:hidden"><Sparkles className="h-4 w-4" />Connection space</Link></DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => patch({ muted: !conv.muted })} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2">{conv.muted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}{conv.muted ? 'Unmute' : 'Mute notifications'}</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => patch({ archived: !conv.archived })} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2"><Archive className="h-4 w-4" />{conv.archived ? 'Move to inbox' : 'Archive'}</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => setReportMember(true)} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-bg">Report {other.displayName}</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      <div className="flex-1 space-y-1 overflow-y-auto bg-canvas/50 px-4 py-5" role="log" aria-label={`Conversation with ${other.displayName}`} aria-live="polite">
        {cursor && <div className="mb-4 flex justify-center"><Button size="sm" variant="ghost" onClick={loadEarlier}>Load earlier messages</Button></div>}
        {messages.map((m) => {
          const day = dayLabel(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <React.Fragment key={m.id}>
              {showDay && <p className="py-3 text-center text-xs uppercase tracking-wider text-muted">{day}</p>}
              {m.kind === 'system' ? (
                <p className="mx-auto max-w-sm py-2 text-center text-xs text-muted">{m.body}</p>
              ) : (
                <div className={cn('group flex items-end gap-2', m.isMine ? 'justify-end' : 'justify-start')}>
                  {!m.isMine && (
                    <button type="button" onClick={() => setReportMsg(m.id)} className="order-2 rounded-full p-1 text-xs text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100" aria-label="Report this message"><AlertCircle className="h-3.5 w-3.5" /></button>
                  )}
                  <div className={cn('max-w-[78%] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed shadow-soft', m.isMine ? 'rounded-br-md bg-burgundy-600 text-white' : 'rounded-bl-md bg-surface text-ink', m.failed && 'opacity-60')}>
                    {m.kind === 'image' && (m.mediaUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <a href={m.mediaUrl} target="_blank" rel="noreferrer"><img src={m.mediaUrl} alt="Shared photo" className="mb-1 max-h-72 rounded-xl object-cover" /></a>
                      : <span className="text-sm opacity-80">📷 Photo</span>)}
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    <p className={cn('mt-1 text-right text-[0.68rem]', m.isMine ? 'text-white/70' : 'text-muted')}>
                      {m.pending ? 'Sending…' : m.failed ? <button type="button" className="underline" onClick={() => retry(m)}>Not sent · Retry</button> : timeLabel(m.createdAt)}
                    </p>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
        {seen && <p className="pr-1 text-right text-[0.7rem] text-muted">Seen</p>}
        <div ref={bottomRef} />
      </div>

      {conv.isLocked ? (
        <p className="flex items-center justify-center gap-2 border-t border-line px-4 py-4 text-sm text-muted"><Lock className="h-4 w-4" />This conversation is closed and read-only.</p>
      ) : (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
          {me.featureFlags.chat_images !== false && (
            <>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" id="chat-image" onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendImage(f); }} />
              <label htmlFor="chat-image" className={cn('flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink', uploading && 'pointer-events-none')} aria-label="Share a photo">
                {uploading ? <Spinner className="h-4 w-4" label="Uploading photo" /> : <ImagePlus className="h-5 w-5" />}
              </label>
            </>
          )}
          <label htmlFor="composer" className="sr-only">Message</label>
          <textarea
            id="composer"
            rows={1}
            maxLength={4000}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); sendTyping(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message ${other.displayName}`}
            className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-canvas px-4 py-2.5 text-[0.95rem] focus:border-burgundy-500 focus:outline-none focus:ring-4 focus:ring-burgundy-100"
          />
          <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!draft.trim()} aria-label="Send message"><SendHorizontal /></Button>
        </form>
      )}

      <ReportDialog open={!!reportMsg} onOpenChange={(o) => !o && setReportMsg(null)} targetMessageId={reportMsg ?? undefined} name="this message" />
      <ReportDialog open={reportMember} onOpenChange={setReportMember} targetProfileId={other.id} name={other.displayName} />
    </div>
  );
}
