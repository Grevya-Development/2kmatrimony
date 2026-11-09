'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LifeBuoy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, CardContent, Dialog, DialogContent, EmptyState, ErrorState, Field, Input, NativeSelect, PageHeader, Skeleton, Textarea } from '@/components/ui';

interface Ticket { id: string; subject: string; category: string; status: string; priority: string; created_at: string; updated_at: string }
interface Thread { ticket: Ticket; messages: { id: string; body: string; is_staff: boolean; created_at: string }[] }

const CATEGORIES: [string, string][] = [['account', 'My account'], ['billing', 'Billing & payments'], ['verification', 'Verification'], ['safety', 'Safety concern'], ['technical', 'Something isn’t working'], ['feedback', 'Feedback'], ['other', 'Something else']];
const STATUS: Record<string, { label: string; tone: 'warning' | 'info' | 'success' | 'neutral' }> = {
  open: { label: 'With our team', tone: 'warning' }, pending_user: { label: 'Awaiting your reply', tone: 'info' }, resolved: { label: 'Resolved', tone: 'success' }, closed: { label: 'Closed', tone: 'neutral' },
};
const when = (s: string) => new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function useLoad<T>(path: string) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(() => { setError(null); api<T>(path).then(setData).catch((e: Error) => setError(e.message)); }, [path]);
  React.useEffect(load, [load]);
  return { data, error, load };
}

export function SupportList() {
  const { data, error, load } = useLoad<Ticket[]>('/support/tickets');
  return (
    <>
      <PageHeader eyebrow="Help & support" title="How can we help?" description="Our team usually replies within one working day. For anything that affects your safety, choose “Safety concern” so it is prioritised." actions={<NewTicket onCreated={load} />} />
      {error ? <ErrorState message={error} onRetry={load} /> : !data ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={<LifeBuoy />} title="No requests yet" description="When you contact support, your conversation appears here." />
      ) : (
        <ul className="space-y-3">
          {data.map((t) => (
            <li key={t.id}>
              <Link href={`/app/support/${t.id}`} className="block rounded-2xl border border-line bg-surface p-5 shadow-soft transition hover:border-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-medium text-ink">{t.subject}</p><p className="mt-1 text-sm text-muted">{CATEGORIES.find((c) => c[0] === t.category)?.[1]} · updated {when(t.updated_at)}</p></div>
                  <Badge tone={STATUS[t.status]?.tone ?? 'neutral'}>{STATUS[t.status]?.label ?? t.status}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function NewTicket({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ category: 'account', subject: '', body: '' });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}><Plus />New request</Button>
      <DialogContent title="Contact support" description="Please don’t include passwords or full ID numbers.">
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setError(null);
          try {
            const t = await api<Ticket>('/support/tickets', { body: form });
            toast.success('Request sent');
            setOpen(false);
            onCreated();
            router.push(`/app/support/${t.id}`);
          } catch (err) { setError(err instanceof ApiClientError ? err.message : 'Could not send.'); }
          setBusy(false);
        }}>
          <Field label="Topic" htmlFor="t-cat"><NativeSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect></Field>
          <Field label="Subject" htmlFor="t-subject"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} required minLength={3} /></Field>
          <Field label="How can we help?" htmlFor="t-body"><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={5000} required className="min-h-32" /></Field>
          {error && <ErrorState message={error} />}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={busy} disabled={form.subject.trim().length < 3 || !form.body.trim()}>Send</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SupportThread({ id }: { id: string }) {
  const { data, error, load } = useLoad<Thread>(`/support/tickets/${id}`);
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/support" className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />All requests</Link>
      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <Skeleton className="h-64" /> : (
        <Card>
          <CardContent className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div><h1 className="font-serif text-3xl leading-tight">{data.ticket.subject}</h1><p className="mt-1 text-sm text-muted">Opened {when(data.ticket.created_at)}</p></div>
              <Badge tone={STATUS[data.ticket.status]?.tone ?? 'neutral'}>{STATUS[data.ticket.status]?.label ?? data.ticket.status}</Badge>
            </div>
            <ol className="space-y-3" aria-label="Conversation">
              {data.messages.map((m) => (
                <li key={m.id} className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm', m.is_staff ? 'bg-emerald-50 text-ink' : 'ml-auto bg-surface-2 text-ink')}>
                  <p className="mb-1 text-xs text-muted">{m.is_staff ? '2K Marriage support' : 'You'} · {when(m.created_at)}</p>
                  <p className="whitespace-pre-line">{m.body}</p>
                </li>
              ))}
            </ol>
            {data.ticket.status === 'closed' ? (
              <p className="text-sm text-muted">This request is closed. Start a new request if you need more help.</p>
            ) : (
              <form className="space-y-3 border-t border-line pt-4" onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try { await api(`/support/tickets/${id}`, { body: { body: body.trim() } }); setBody(''); load(); }
                catch (err) { toast.error(err instanceof ApiClientError ? err.message : 'Could not send.'); }
                setBusy(false);
              }}>
                <Field label="Your reply" htmlFor="reply"><Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} className="min-h-24" /></Field>
                <div className="flex justify-end"><Button type="submit" loading={busy} disabled={!body.trim()}>Send reply</Button></div>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
