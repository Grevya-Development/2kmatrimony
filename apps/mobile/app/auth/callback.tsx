import * as React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ErrorState, Loading, Screen } from '@/components/ui';

/** Deep-link landing for email magic links / OAuth (PKCE code exchange). */
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    (async () => {
      const existing = (await supabase.auth.getSession()).data.session;
      if (!code) return router.replace(existing ? '/' : '/sign-in');
      const { error: err } = await supabase.auth.exchangeCodeForSession(code);
      if (err && !existing) setError('This sign-in link has expired. Please request a new one.');
      else router.replace('/');
    })();
  }, [code]);
  return <Screen>{error ? <ErrorState message={error} onRetry={() => router.replace('/sign-in')} /> : <Loading label="Signing you in" />}</Screen>;
}
