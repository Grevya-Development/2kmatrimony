'use client';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CREATED_FOR_OPTIONS, type CreatedFor } from '@2k/shared';
import { api, ApiClientError } from '@/lib/api';
import { Button, Checkbox, ChipGroup, Field, Input, Label } from '@/components/ui';

export function StartStep({ onDone }: { onDone: (createdFor: CreatedFor) => void }) {
  const [createdFor, setCreatedFor] = React.useState<CreatedFor | null>(null);
  const [relation, setRelation] = React.useState('');
  const [terms, setTerms] = React.useState(false);
  const [ai, setAi] = React.useState(false); // DPDP: optional consent is opt-in, never pre-ticked
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdFor || !terms) return;
    setBusy(true);
    try {
      await api('/profile', { body: { createdFor, managedByRelation: createdFor === 'self' ? null : relation || null, consents: { terms: true, privacy: true, aiProcessing: ai } } });
      onDone(createdFor);
    } catch (err) {
      toast.error((err as ApiClientError).message);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium text-ink-2">Who is this profile for?</p>
        <ChipGroup label="Who is this profile for?" options={CREATED_FOR_OPTIONS} value={createdFor ? [createdFor] : []} onChange={([x]) => setCreatedFor(x ?? null)} />
      </div>
      {createdFor && createdFor !== 'self' && (
        <Field label="Your relationship to them" htmlFor="relation" optional hint="For example: mother, elder brother. They stay in control once they join.">
          <Input value={relation} onChange={(e) => setRelation(e.target.value)} maxLength={40} />
        </Field>
      )}
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <Checkbox id="terms" checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
          <Label htmlFor="terms" className="font-normal leading-relaxed">
            I agree to the <Link href="/legal/terms" target="_blank" className="underline underline-offset-2">Terms</Link> and <Link href="/legal/privacy" target="_blank" className="underline underline-offset-2">Privacy Policy</Link>, and confirm {createdFor && createdFor !== 'self' ? 'I have their consent to create this profile and that they are' : 'I am'} at least 18.
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="ai" checked={ai} onCheckedChange={(v) => setAi(v === true)} className="mt-0.5" />
          <Label htmlFor="ai" className="font-normal leading-relaxed text-muted">
            <span className="text-ink-2">Use AI to personalise matches and explanations.</span> AI reads profile answers only — never private messages — and you can turn this off anytime. Optional.
          </Label>
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!createdFor || !terms} loading={busy}>Continue</Button>
    </form>
  );
}
