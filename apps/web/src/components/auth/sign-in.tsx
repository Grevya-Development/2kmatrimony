'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Smartphone } from 'lucide-react';
import { Button, ErrorState, Field, Input, Notice } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

type Method = 'phone' | 'email';
type Step = 'enter' | 'code';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/app');

export function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const supabase = supabaseBrowser();
  const [method, setMethod] = React.useState<Method>('phone');
  const [step, setStep] = React.useState<Step>('enter');
  const [usePassword, setUsePassword] = React.useState(false);
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(params.get('error') ? 'Sign-in could not be completed. Please try again.' : null);
  const [info, setInfo] = React.useState<string | null>(null);

  const e164 = () => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 ? `+91${digits}` : `+${digits}`;
  };
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const done = () => { router.replace(next); router.refresh(); };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    if (method === 'phone') {
      const { error: err } = await supabase.auth.signInWithOtp({ phone: e164() });
      if (err) setError(err.message); else setStep('code');
    } else if (usePassword) {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        // New member: create the account with a password instead.
        if (/invalid login credentials/i.test(err.message)) {
          const { data, error: signUpErr } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo() } });
          if (signUpErr) setError(signUpErr.message);
          else if (data.session) done();
          else setInfo('Check your inbox to confirm your email, then sign in.');
        } else setError(err.message);
      } else done();
    } else {
      const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo() } });
      if (err) setError(err.message); else { setStep('code'); setInfo('We sent a sign-in link and a 6-digit code to your email.'); }
    }
    setBusy(false);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error: err } = method === 'phone'
      ? await supabase.auth.verifyOtp({ phone: e164(), token: code.trim(), type: 'sms' })
      : await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (err) setError('That code is incorrect or has expired.'); else done();
  };

  const oauth = async (provider: 'google' | 'apple') => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
    if (err) setError(err.message.includes('not enabled') ? `${provider === 'google' ? 'Google' : 'Apple'} sign-in is not configured yet.` : err.message);
  };

  const forgot = async () => {
    if (!email.trim()) return setError('Enter your email first.');
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset` });
    setBusy(false);
    if (err) setError(err.message); else setInfo('If an account exists, we sent a password reset link.');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl leading-tight">{step === 'code' ? 'Enter your code' : 'Welcome'}</h1>
        <p className="mt-2 text-muted">{step === 'code' ? `Sent to ${method === 'phone' ? e164() : email}.` : 'Sign in or create your account. It takes less than a minute.'}</p>
      </div>

      {step === 'enter' && (
        <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-full border border-line bg-surface p-1">
          {(['phone', 'email'] as Method[]).map((m) => (
            <button key={m} role="tab" aria-selected={method === m} type="button" onClick={() => { setMethod(m); setError(null); }}
              className={cn('flex items-center justify-center gap-2 rounded-full py-2 text-sm font-medium transition-colors', method === m ? 'bg-ink text-canvas' : 'text-muted hover:text-ink')}>
              {m === 'phone' ? <Smartphone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}{m === 'phone' ? 'Mobile' : 'Email'}
            </button>
          ))}
        </div>
      )}

      {step === 'enter' ? (
        <form onSubmit={sendCode} className="space-y-5">
          {method === 'phone' ? (
            <Field label="Mobile number" htmlFor="phone" hint="We’ll text you a one-time code.">
              <div className="flex gap-2">
                <span className="flex h-12 items-center rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink-2">+91</span>
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </Field>
          ) : (
            <>
              <Field label="Email" htmlFor="email">
                <Input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              {usePassword && (
                <Field label="Password" htmlFor="password" hint="At least 8 characters with letters and numbers.">
                  <Input type="password" autoComplete="current-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Field>
              )}
            </>
          )}
          {error && <ErrorState message={error} />}
          {info && <Notice>{info}</Notice>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>{method === 'email' && usePassword ? 'Continue' : 'Send code'}</Button>
          {method === 'email' && (
            <div className="flex justify-between text-sm">
              <button type="button" className="text-muted hover:text-ink" onClick={() => setUsePassword((v) => !v)}>{usePassword ? 'Use a one-time code instead' : 'Use a password instead'}</button>
              {usePassword && <button type="button" className="text-burgundy-600 hover:underline" onClick={forgot}>Forgot password?</button>}
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-5">
          <Field label="6-digit code" htmlFor="otp">
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="text-center font-mono text-xl tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          </Field>
          {error && <ErrorState message={error} />}
          {info && <Notice>{info}</Notice>}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length !== 6}>Verify & continue</Button>
          <button type="button" className="w-full text-sm text-muted hover:text-ink" onClick={() => { setStep('enter'); setCode(''); setInfo(null); }}>Use a different {method === 'phone' ? 'number' : 'email'}</button>
        </form>
      )}

      {step === 'enter' && (
        <>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <div className="grid gap-3">
            <Button variant="secondary" size="lg" onClick={() => oauth('google')}>Continue with Google</Button>
            <Button variant="secondary" size="lg" onClick={() => oauth('apple')}>Continue with Apple</Button>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted">
            By continuing you agree to our <Link href="/legal/terms" className="underline underline-offset-2">Terms</Link> and <Link href="/legal/privacy" className="underline underline-offset-2">Privacy Policy</Link>. You must be 18 or older.
          </p>
        </>
      )}
    </div>
  );
}
