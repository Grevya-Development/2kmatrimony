'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Button, Card, CardContent, Field, Input, ErrorState } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/browser';

/** Requires admins to enrol/verify a TOTP factor (AAL2) before using the panel. */
export function AdminMfaGate() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.auth.mfa.listFactors();
      if (e) return setError(e.message);
      const verified = data.totp.find((f) => f.status === 'verified');
      if (verified) return setFactorId(verified.id);
      const { data: enrol, error: enErr } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Admin ${new Date().toISOString().slice(0, 10)}` });
      if (enErr) return setError(enErr.message);
      setFactorId(enrol.id);
      setQr(enrol.totp.qr_code);
      setSecret(enrol.totp.secret);
    })();
  }, [supabase]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: e2 } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (e2) return setError('That code did not work. Check your authenticator app and try again.');
    router.refresh();
  };

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><ShieldCheck className="h-6 w-6" /></div>
          <div>
            <h1 className="font-serif text-3xl">Verify it’s you</h1>
            <p className="mt-2 text-sm text-muted">The admin panel requires multi-factor authentication. {qr ? 'Scan this code with an authenticator app, then enter the 6-digit code.' : 'Enter the 6-digit code from your authenticator app.'}</p>
          </div>
          {qr && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Authenticator QR code" className="mx-auto h-44 w-44 rounded-xl border border-line bg-white p-2" />
              {secret && <p className="break-all text-center font-mono text-xs text-muted">{secret}</p>}
            </div>
          )}
          <form onSubmit={verify} className="space-y-4">
            <Field label="Authentication code" htmlFor="mfa-code">
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            </Field>
            {error && <ErrorState message={error} />}
            <Button type="submit" className="w-full" loading={busy} disabled={code.length !== 6 || !factorId}>Verify</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
