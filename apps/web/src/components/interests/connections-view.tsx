'use client';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { MessageCircle, MoreHorizontal, Sparkles, Users } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { relativeTime, type ConnectionItem } from '@2k/shared';
import { Avatar, Button, Dialog, DialogContent, EmptyState, ErrorState, Field, PageHeader, Skeleton, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { showApiError, useApiData } from '@/components/discovery/hooks';

function CloseDialog({ conn, open, onOpenChange, onClosed }: { conn: ConnectionItem; open: boolean; onOpenChange: (o: boolean) => void; onClosed: () => void }) {
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api(`/connections/${conn.id}/close`, { body: { reason: reason || null } });
      toast.success('Connection closed. The conversation is now read-only.');
      onOpenChange(false);
      onClosed();
    } catch (e) { showApiError(e); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Close connection with ${conn.profile.displayName}?`} description="It’s okay to decide this isn’t the right fit. The conversation will become read-only for both of you.">
        <Field label="A private note for yourself" htmlFor="close-reason" optional>
          <Textarea maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={submit}>Close connection</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConnectionRow({ conn, onClosed }: { conn: ConnectionItem; onClosed: () => void }) {
  const [closeOpen, setCloseOpen] = React.useState(false);
  const p = conn.profile;
  return (
    <li className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <Link href={`/app/connections/${conn.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <Avatar src={p.photoUrl} name={p.displayName} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-serif text-xl">{p.displayName}</p>
            <span className="shrink-0 text-xs text-muted">{conn.lastMessageAt ? relativeTime(conn.lastMessageAt) : `Connected ${relativeTime(conn.createdAt)}`}</span>
          </div>
          <p className="truncate text-sm text-muted">{conn.lastMessagePreview ?? 'Say hello when you’re ready.'}</p>
        </div>
      </Link>
      {conn.unreadCount > 0 && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white" aria-label={`${conn.unreadCount} unread`}>{conn.unreadCount}</span>}
      <div className="flex items-center gap-1">
        {conn.conversationId && <Button size="icon" variant="secondary" asChild className="h-9 w-9" aria-label={`Message ${p.displayName}`}><Link href={`/app/messages/${conn.conversationId}`}><MessageCircle /></Link></Button>}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><Button size="icon" variant="ghost" className="h-9 w-9" aria-label="More"><MoreHorizontal /></Button></DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" className="z-50 min-w-48 rounded-xl border border-line bg-surface p-1.5 shadow-lift">
              <DropdownMenu.Item asChild><Link href={`/app/connections/${conn.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2"><Sparkles className="h-4 w-4" />Connection space</Link></DropdownMenu.Item>
              <DropdownMenu.Item asChild><Link href={`/app/profile/${p.id}`} className="block rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2">View profile</Link></DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => setCloseOpen(true)} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-bg">Close connection</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      <CloseDialog conn={conn} open={closeOpen} onOpenChange={setCloseOpen} onClosed={onClosed} />
    </li>
  );
}

export function ConnectionsView() {
  const { data, setData, error, loading, reload } = useApiData<ConnectionItem[]>('/connections');
  return (
    <div>
      <PageHeader eyebrow="Connections" title="Your connections" description="People you share mutual interest with. Open a connection space for compatibility insights, a shared vision board and meeting plans." />
      {loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        : error ? <ErrorState message={error} onRetry={reload} />
        : !data?.length ? <EmptyState icon={<Users />} title="No connections yet" description="When an interest becomes mutual, you’ll be connected here." action={<Button asChild><Link href="/app/interests">Review interests</Link></Button>} />
        : <ul className="space-y-3">{data.map((c) => <ConnectionRow key={c.id} conn={c} onClosed={() => setData((cur) => cur?.filter((x) => x.id !== c.id) ?? null)} />)}</ul>}
    </div>
  );
}
