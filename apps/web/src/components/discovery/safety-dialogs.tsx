'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { REPORT_REASON_OPTIONS, type ReportReason } from '@2k/shared';
import { Button, Dialog, DialogContent, Field, NativeSelect, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { showApiError } from './hooks';

export function ReportDialog({ open, onOpenChange, targetProfileId, targetMessageId, name }: { open: boolean; onOpenChange: (o: boolean) => void; targetProfileId?: string; targetMessageId?: string; name: string }) {
  const [reason, setReason] = React.useState<ReportReason>('fake_profile');
  const [details, setDetails] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/reports', { body: { targetProfileId, targetMessageId, reason, details: details || null } });
      toast.success('Thank you. Our team will review this report confidentially.');
      onOpenChange(false);
      setDetails('');
    } catch (err) { showApiError(err); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Report ${name}`} description="Reports are confidential and reviewed by our trust & safety team. If you are in immediate danger, contact local emergency services (112).">
        <form onSubmit={submit} className="space-y-4">
          <Field label="What’s happening?" htmlFor="report-reason">
            <NativeSelect value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
              {REPORT_REASON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Details" htmlFor="report-details" optional hint="Anything that helps us understand — never shared with the member.">
            <Textarea maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Submit report</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BlockDialog({ open, onOpenChange, targetProfileId, name, onBlocked }: { open: boolean; onOpenChange: (o: boolean) => void; targetProfileId: string; name: string; onBlocked?: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await api('/blocks', { body: { targetProfileId } });
      toast.success(`${name} is blocked. You won’t see each other anywhere.`);
      onOpenChange(false);
      onBlocked?.();
    } catch (err) { showApiError(err); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Block ${name}?`} description="You won’t appear to each other in search, recommendations or messages. Any pending interest is withdrawn and an existing connection is closed. They won’t be notified.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={confirm}>Block</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
