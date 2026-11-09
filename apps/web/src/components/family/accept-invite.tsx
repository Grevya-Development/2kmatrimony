'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartHandshake } from 'lucide-react';
import { Button, Card, CardContent, Checkbox, ErrorState } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';

export function AcceptInvite({ token, signedIn }: { token: string; signedIn: boolean }) {
  const router = useRouter();
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const next = `/family/accept?token=${encodeURIComponent(token)}`;

  const accept = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api<{ profileId: string }>('/family/accept', { body: { token, acceptTerms: agree } });
      router.replace(`/family/${r.profileId}`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not accept the invitation.');
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardContent className="space-y-6 p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-champagne-100 text-champagne-600"><HeartHandshake className="h-6 w-6" /></div>
        <div>
          <h1 className="font-serif text-3xl">You’ve been invited to help</h1>
          <p className="mt-2 text-sm text-muted">A family member would like your help with their matrimony search. You’ll only be able to do what they allow, and they stay in control of every decision.</p>
        </div>
        {!token ? <ErrorState message="This invitation link is incomplete." /> : !signedIn ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">Sign in with the email or mobile number this invitation was sent to. You don’t need a matrimony profile of your own.</p>
            <Button asChild className="w-full"><Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in to continue</Link></Button>
          </div>
        ) : (
          <div className="space-y-4">
            <label htmlFor="fam-agree" className="flex items-start gap-3 text-sm text-ink-2">
              <Checkbox id="fam-agree" checked={agree} onCheckedChange={(c) => setAgree(c === true)} className="mt-0.5" />
              <span>I agree to the <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>, and I’ll keep what I see private.</span>
            </label>
            {error && <ErrorState message={error} />}
            <Button className="w-full" onClick={accept} loading={busy} disabled={!agree}>Accept invitation</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
