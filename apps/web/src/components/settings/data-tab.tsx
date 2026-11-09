'use client';
import * as React from 'react';
import { Download, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { DataRequestItem } from '@2k/shared';
import { useMe } from '@/components/shell/me-context';
import { api, ApiClientError } from '@/lib/api';
import { Badge, Button, Card, CardContent, Dialog, DialogContent, Field, Input, Notice, Textarea } from '@/components/ui';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export function DataTab() {
  const { me, refresh } = useMe();
  const [requests, setRequests] = React.useState<DataRequestItem[]>([]);
  const [exporting, setExporting] = React.useState(false);
  const [link, setLink] = React.useState<{ url: string; expiresAt: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => { try { setRequests(await api<DataRequestItem[]>('/privacy/requests')); } catch { /* list is informational */ } }, []);
  React.useEffect(() => { void load(); }, [load]);
  const pending = requests.find((r) => r.kind === 'deletion' && r.status === 'pending');

  const doExport = async () => {
    setExporting(true);
    try { const r = await api<{ url: string; expiresAt: string }>('/privacy/export', { method: 'POST' }); setLink(r); window.open(r.url, '_blank', 'noopener'); await load(); }
    catch (e) { toast.error((e as ApiClientError).message); } finally { setExporting(false); }
  };
  const schedule = async () => {
    setBusy(true);
    try { await api('/privacy/deletion', { body: { confirm: confirmText, reason: reason || null } }); toast.success('Account deletion scheduled'); setConfirmOpen(false); await Promise.all([load(), refresh()]); }
    catch (e) { toast.error((e as ApiClientError).message); } finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true);
    try { await api('/privacy/deletion', { method: 'DELETE' }); toast.success('Welcome back — your account is active again.'); await Promise.all([load(), refresh()]); }
    catch (e) { toast.error((e as ApiClientError).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Card><CardContent className="space-y-4">
        <div><h2 className="font-serif text-2xl">Download your data</h2><p className="text-sm text-muted">A JSON file with your profile, preferences, consents, activity and billing records. The link expires after a short time.</p></div>
        <Button variant="secondary" onClick={doExport} loading={exporting}><Download />Prepare my data</Button>
        {link && <Notice tone="success">Your file is ready. <a href={link.url} className="font-medium underline" target="_blank" rel="noopener noreferrer">Download</a> — link valid until {new Date(link.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.</Notice>}
        {requests.length > 0 && (
          <ul className="divide-y divide-line text-sm">{requests.slice(0, 6).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2"><span className="capitalize">{r.kind} request · {fmt(r.createdAt)}</span>
              <Badge tone={r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : r.status === 'cancelled' ? 'neutral' : 'warning'}>{r.status}</Badge></li>
          ))}</ul>
        )}
      </CardContent></Card>

      <Card className="border-danger/20"><CardContent className="space-y-4">
        <div><h2 className="font-serif text-2xl">Delete account</h2>
          <p className="text-sm text-muted">Your profile is hidden immediately and everything is permanently deleted after the grace period. Records we must keep by law (such as GST invoices) are retained without your profile.</p></div>
        {me.user.status === 'pending_deletion' || pending ? (
          <Notice tone="warning">
            <span className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Deletion is scheduled{pending?.scheduledFor ? ` for ${fmt(pending.scheduledFor)}` : ''}. Your profile is hidden until then.</span>
              <Button size="sm" variant="secondary" onClick={cancel} loading={busy}>Cancel deletion</Button>
            </span>
          </Notice>
        ) : (
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>Delete my account</Button>
        )}
      </CardContent></Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent title="Delete your account?" description="You can cancel during the grace period by signing in and returning here.">
          <div className="space-y-5">
            <Notice tone="warning"><span className="flex gap-2"><TriangleAlert className="h-4 w-4 shrink-0" />Connections, conversations, shortlists and verification will be permanently removed.</span></Notice>
            <Field label="Anything you’d like to share? (optional)" htmlFor="reason"><Textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <Field label="Type DELETE to confirm" htmlFor="confirmDelete"><Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></Field>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Keep my account</Button>
              <Button variant="danger" disabled={confirmText !== 'DELETE'} loading={busy} onClick={schedule}>Schedule deletion</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
