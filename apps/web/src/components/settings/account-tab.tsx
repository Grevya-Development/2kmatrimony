'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { useMe } from '@/components/shell/me-context';
import { api, ApiClientError } from '@/lib/api';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button, Card, CardContent, Field, Input, NativeSelect } from '@/components/ui';

const LOCALES = [
  { value: 'en', label: 'English' }, { value: 'hi', label: 'हिन्दी (Hindi)' }, { value: 'ta', label: 'தமிழ் (Tamil)' },
  { value: 'te', label: 'తెలుగు (Telugu)' }, { value: 'kn', label: 'ಕನ್ನಡ (Kannada)' }, { value: 'ml', label: 'മലയാളം (Malayalam)' },
];

export function AccountTab() {
  const { me, refresh } = useMe();
  const supabase = supabaseBrowser();
  const [name, setName] = React.useState(me.user.fullName ?? '');
  const [locale, setLocale] = React.useState<string>(me.user.preferredLocale);
  const [saving, setSaving] = React.useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await api('/account', { method: 'PATCH', body: { fullName: name || null, preferredLocale: locale } }); await refresh(); toast.success('Account updated'); }
    catch (err) { toast.error((err as ApiClientError).message); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <Card><CardContent>
        <form onSubmit={save} className="space-y-5">
          <h2 className="font-serif text-2xl">Account</h2>
          <Field label="Account holder name" htmlFor="fullName" hint="Used for invoices and account emails, not shown on the profile."><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
          <Field label="Preferred language" htmlFor="locale" hint="Used for notifications and the AI matchmaker. More of the app is being translated progressively.">
            <NativeSelect value={locale} onChange={(e) => setLocale(e.target.value)}>{LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</NativeSelect>
          </Field>
          <Button type="submit" loading={saving}>Save</Button>
        </form>
      </CardContent></Card>
      <ContactCard kind="phone" current={me.user.phone} onChanged={refresh} />
      <ContactCard kind="email" current={me.user.email} onChanged={refresh} />
      {me.user.email && <PasswordCard />}
      <Card><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-serif text-2xl">Sign out everywhere</h2><p className="text-sm text-muted">Ends sessions on all devices, including this one.</p></div>
        <Button variant="secondary" onClick={async () => { await supabase.auth.signOut({ scope: 'global' }); window.location.href = '/login'; }}>Sign out all devices</Button>
      </CardContent></Card>
    </div>
  );
}

function ContactCard({ kind, current, onChanged }: { kind: 'phone' | 'email'; current: string | null; onChanged: () => Promise<void> }) {
  const supabase = supabaseBrowser();
  const [value, setValue] = React.useState('');
  const [code, setCode] = React.useState('');
  const [stage, setStage] = React.useState<'idle' | 'code' | 'sent'>('idle');
  const [busy, setBusy] = React.useState(false);
  const target = kind === 'phone' ? (value.replace(/\D/g, '').length === 10 ? `+91${value.replace(/\D/g, '')}` : `+${value.replace(/\D/g, '')}`) : value.trim();

  const start = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.updateUser(kind === 'phone' ? { phone: target } : { email: target }, kind === 'email' ? { emailRedirectTo: `${window.location.origin}/auth/callback?next=/app/settings` } : undefined);
    setBusy(false);
    if (error) return toast.error(error.message);
    setStage(kind === 'phone' ? 'code' : 'sent');
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: target, token: code, type: 'phone_change' });
    setBusy(false);
    if (error) return toast.error('That code is incorrect or has expired.');
    toast.success('Mobile number verified'); setStage('idle'); setValue(''); setCode(''); await onChanged();
  };

  return (
    <Card><CardContent className="space-y-4">
      <div><h2 className="font-serif text-2xl">{kind === 'phone' ? 'Mobile number' : 'Email'}</h2>
        <p className="text-sm text-muted">{current ? `Current: ${current}` : `No ${kind === 'phone' ? 'mobile number' : 'email'} added yet.`} Verified contacts earn a badge and help secure your account.</p></div>
      {stage === 'idle' && (
        <form onSubmit={start} className="flex flex-col gap-3 sm:flex-row">
          <Input aria-label={kind === 'phone' ? 'New mobile number' : 'New email'} type={kind === 'phone' ? 'tel' : 'email'} placeholder={kind === 'phone' ? '98765 43210' : 'you@example.com'} value={value} onChange={(e) => setValue(e.target.value)} required />
          <Button type="submit" variant="secondary" loading={busy}>{current ? 'Change' : 'Add'}</Button>
        </form>
      )}
      {stage === 'code' && (
        <form onSubmit={verify} className="flex flex-col gap-3 sm:flex-row">
          <Input aria-label="Verification code" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <Button type="submit" loading={busy} disabled={code.length !== 6}>Verify</Button>
          <Button type="button" variant="ghost" onClick={() => setStage('idle')}>Cancel</Button>
        </form>
      )}
      {stage === 'sent' && <p className="text-sm text-success">We sent a confirmation link to {target}. Open it to finish the change.</p>}
    </CardContent></Card>
  );
}

function PasswordCard() {
  const [pw, setPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  return (
    <Card><CardContent>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
        setBusy(false);
        if (error) toast.error(error.message); else { toast.success('Password updated'); setPw(''); }
      }}>
        <h2 className="font-serif text-2xl">Password</h2>
        <Field label="New password" htmlFor="newpw" hint="At least 8 characters with letters and numbers. Optional — you can always sign in with a code.">
          <Input type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" loading={busy} disabled={pw.length < 8}>Update password</Button>
      </form>
    </CardContent></Card>
  );
}
