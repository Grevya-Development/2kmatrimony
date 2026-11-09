'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button, ErrorState, Field, Input } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const { error: err } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.message);
    router.replace('/app');
  };

  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-6">
        <div>
          <h1 className="font-serif text-4xl">Choose a new password</h1>
          <p className="mt-2 text-muted">Use at least 8 characters with letters and numbers.</p>
        </div>
        <Field label="New password" htmlFor="pw"><Input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <Field label="Confirm password" htmlFor="pw2"><Input type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></Field>
        {error && <ErrorState message={error} />}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
      </form>
    </AuthLayout>
  );
}
