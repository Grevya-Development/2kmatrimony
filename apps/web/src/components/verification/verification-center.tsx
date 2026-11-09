'use client';
import * as React from 'react';
import Link from 'next/link';
import { BadgeCheck, Briefcase, Camera, GraduationCap, IdCard, Mail, Smartphone, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { VERIFICATION_KIND_LABELS, type VerificationItem, type VerificationKind } from '@2k/shared';
import { api, ApiClientError, uploadToSignedUrl } from '@/lib/api';
import { Badge, Button, Card, CardContent, Dialog, DialogContent, ErrorState, Field, Input, NativeSelect, Notice, Skeleton } from '@/components/ui';

const ICONS: Record<VerificationKind, React.ReactNode> = {
  phone: <Smartphone />, email: <Mail />, government_id: <IdCard />, photo: <Camera />, employment: <Briefcase />, education: <GraduationCap />,
};
const DESCRIPTIONS: Record<VerificationKind, string> = {
  phone: 'Confirmed when you sign in with a one-time code.',
  email: 'Confirmed through a sign-in link or code.',
  government_id: 'Confirms your name and age match a government ID. Your document is never shown to members.',
  photo: 'A selfie compared with your profile photos to confirm they are you.',
  employment: 'Confirms where you work using an offer letter, payslip or work ID.',
  education: 'Confirms your highest qualification.',
};
const DOC_OPTIONS: Record<string, { value: string; label: string }[]> = {
  government_id: [
    { value: 'aadhaar_masked', label: 'Masked Aadhaar (first 8 digits hidden)' }, { value: 'passport', label: 'Passport' },
    { value: 'driving_licence', label: 'Driving licence' }, { value: 'pan', label: 'PAN card' }, { value: 'voter_id', label: 'Voter ID' },
  ],
  employment: [{ value: 'offer_letter', label: 'Offer letter' }, { value: 'payslip', label: 'Recent payslip' }, { value: 'employee_id', label: 'Employee ID card' }, { value: 'work_email', label: 'Screenshot of work email' }],
  education: [{ value: 'degree', label: 'Degree certificate' }, { value: 'marksheet', label: 'Final marksheet' }, { value: 'provisional_certificate', label: 'Provisional certificate' }],
  photo: [{ value: 'selfie', label: 'Selfie' }],
};

function StatusBadge({ item }: { item: VerificationItem }) {
  switch (item.status) {
    case 'approved': return <Badge tone="success"><BadgeCheck />Verified</Badge>;
    case 'pending': case 'in_review': return <Badge tone="warning">Under review</Badge>;
    case 'rejected': return <Badge tone="danger">Not approved</Badge>;
    case 'resubmission_required': return <Badge tone="warning">Needs resubmission</Badge>;
    case 'expired': return <Badge>Expired</Badge>;
    default: return <Badge tone="outline">Not started</Badge>;
  }
}

export function VerificationCenter() {
  const [items, setItems] = React.useState<VerificationItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<VerificationKind | null>(null);
  const load = React.useCallback(async () => {
    try { setError(null); setItems(await api<VerificationItem[]>('/verification')); } catch (e) { setError((e as ApiClientError).message); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>;

  return (
    <div className="space-y-6">
      <Notice>Verified badges confirm only the specific checks below. Everything else on a profile — including yours — is the member’s own statement and is labelled that way.</Notice>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((it) => {
          const canSubmit = !['phone', 'email'].includes(it.kind) && ['not_started', 'rejected', 'resubmission_required', 'expired'].includes(it.status);
          return (
            <li key={it.kind}>
              <Card className="h-full"><CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-100 text-gold-600 [&_svg]:size-5">{ICONS[it.kind]}</span>
                    <h2 className="font-serif text-xl">{VERIFICATION_KIND_LABELS[it.kind]}</h2></div>
                  <StatusBadge item={it} />
                </div>
                <p className="text-sm text-muted">{DESCRIPTIONS[it.kind]}</p>
                {it.rejectionReason && ['rejected', 'resubmission_required'].includes(it.status) && <Notice tone="warning">Reviewer note: {it.rejectionReason}</Notice>}
                <div className="mt-auto pt-2">
                  {canSubmit && <Button variant={it.status === 'not_started' ? 'primary' : 'secondary'} size="sm" onClick={() => setSubmitting(it.kind)}><Upload />{it.status === 'not_started' ? 'Start verification' : 'Resubmit'}</Button>}
                  {it.kind === 'phone' && it.status === 'not_started' && <Button asChild variant="secondary" size="sm"><Link href="/app/settings?tab=account">Add a mobile number</Link></Button>}
                  {it.kind === 'email' && it.status === 'not_started' && <Button asChild variant="secondary" size="sm"><Link href="/app/settings?tab=account">Add an email</Link></Button>}
                  {['pending', 'in_review'].includes(it.status) && <p className="text-xs text-muted">Submitted {it.submittedAt ? new Date(it.submittedAt).toLocaleDateString('en-IN') : ''}. We usually review within two working days.</p>}
                </div>
              </CardContent></Card>
            </li>
          );
        })}
      </ul>
      <Dialog open={submitting !== null} onOpenChange={(o) => !o && setSubmitting(null)}>
        {submitting && <SubmitDialog kind={submitting} onDone={async () => { setSubmitting(null); await load(); }} />}
      </Dialog>
    </div>
  );
}

function SubmitDialog({ kind, onDone }: { kind: VerificationKind; onDone: () => void }) {
  const options = DOC_OPTIONS[kind] ?? [];
  const [docType, setDocType] = React.useState(options[0]?.value ?? '');
  const [files, setFiles] = React.useState<File[]>([]);
  const [meta, setMeta] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const metaField = kind === 'government_id' ? { key: 'last4', label: 'Last 4 characters of the ID number', hint: 'Never enter the full number.' }
    : kind === 'employment' ? { key: 'employer', label: 'Employer name', hint: undefined }
    : kind === 'education' ? { key: 'institution', label: 'Institution', hint: undefined } : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length) return toast.error('Choose a file to upload.');
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of files) {
        const up = await api<{ path: string; signedUrl: string }>('/uploads', { body: { kind: 'verification', contentType: f.type, sizeBytes: f.size } });
        await uploadToSignedUrl(up.signedUrl, f);
        paths.push(up.path);
      }
      await api('/verification', { body: { kind, documentType: docType, documentPaths: paths, submittedData: metaField && meta ? { [metaField.key]: meta } : {} } });
      toast.success('Submitted — we’ll let you know once it’s reviewed.');
      onDone();
    } catch (err) { toast.error((err as ApiClientError).message); } finally { setBusy(false); }
  };

  return (
    <DialogContent title={`Verify ${VERIFICATION_KIND_LABELS[kind].toLowerCase()}`} description="Documents are stored privately, seen only by our verification team, and never shown to members.">
      <form onSubmit={submit} className="space-y-5">
        {kind !== 'photo' && (
          <Field label="Document type" htmlFor="docType"><NativeSelect value={docType} onChange={(e) => setDocType(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
        )}
        <Field label={kind === 'photo' ? 'Take or upload a clear selfie' : 'Upload the document'} htmlFor="docFiles" hint={kind === 'photo' ? 'Face the camera in good light, without sunglasses.' : 'JPG, PNG or PDF, up to 10 MB. Front and back if needed (max 2).'}>
          <Input type="file" accept={kind === 'photo' ? 'image/*' : 'image/jpeg,image/png,image/webp,application/pdf'} capture={kind === 'photo' ? 'user' : undefined} multiple={kind !== 'photo'}
            className="h-auto py-2.5" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 2))} />
        </Field>
        {metaField && <Field label={metaField.label} htmlFor="meta" hint={metaField.hint} optional><Input value={meta} maxLength={kind === 'government_id' ? 4 : 120} onChange={(e) => setMeta(e.target.value)} /></Field>}
        <div className="flex justify-end"><Button type="submit" loading={busy}>Submit for review</Button></div>
      </form>
    </DialogContent>
  );
}
