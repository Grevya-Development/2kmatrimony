'use client';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { ConsentType } from '@2k/shared';
import { api, ApiClientError } from '@/lib/api';
import { Button, Checkbox, Label } from '@/components/ui';

const LABELS: Partial<Record<ConsentType, React.ReactNode>> = {
  terms: <>the updated <Link href="/legal/terms" target="_blank" className="underline underline-offset-2">Terms of Service</Link></>,
  privacy: <>the updated <Link href="/legal/privacy" target="_blank" className="underline underline-offset-2">Privacy Policy</Link></>,
};

/** Re-consent when policies change (me.consentsRequired). */
export function ConsentStep({ required, onDone }: { required: ConsentType[]; onDone: () => void }) {
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState(false);
  const all = required.every((r) => checked[r]);
  const submit = async () => {
    setBusy(true);
    try {
      for (const c of required) await api('/settings/consents', { body: { consentType: c, granted: true } });
      onDone();
    } catch (e) { toast.error((e as ApiClientError).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-6">
      <p className="text-muted">We’ve updated our policies. Please review them to continue.</p>
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        {required.map((c) => (
          <div key={c} className="flex items-start gap-3">
            <Checkbox id={`c-${c}`} checked={!!checked[c]} onCheckedChange={(v) => setChecked((s) => ({ ...s, [c]: v === true }))} className="mt-0.5" />
            <Label htmlFor={`c-${c}`} className="font-normal">I agree to {LABELS[c] ?? c}</Label>
          </div>
        ))}
      </div>
      <Button size="lg" disabled={!all} loading={busy} onClick={submit}>Continue</Button>
    </div>
  );
}
