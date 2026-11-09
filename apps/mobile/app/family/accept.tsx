import * as React from 'react';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { Button, ErrorState, Notice, Screen, Text } from '@/components/ui';

/** Accept a family collaboration invite (deep link: twokmatrimony://family/accept?token=...). */
export default function FamilyAccept() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { session } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ profileId: string; ownerName: string } | null>(null);
  const qc = useQueryClient();

  const accept = async () => {
    if (!token) return;
    setBusy(true); setError(null);
    try { const r = await api.post<{ profileId: string; ownerName: string }>('/family/accept', { token, acceptTerms: true }); haptic.success(); setDone(r); void qc.invalidateQueries({ queryKey: ['me'] }); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Family invitation' }} />
      <Text variant="hero">You’re invited to help</Text>
      <Text variant="bodyMuted">A family member invited you to collaborate on their matrimony search. They stay in control — you’ll only see what they’ve allowed.</Text>
      {!token ? <ErrorState message="This invitation link is incomplete." />
        : !session ? (
          <>
            <Notice>Sign in or create an account first, then open the invitation link again. You don’t need a matrimony profile of your own to help.</Notice>
            <Button title="Sign in" onPress={() => router.push('/sign-in')} />
          </>
        ) : done ? (
          <>
            <Notice tone="success">Invitation accepted. You can now help {done.ownerName} as permitted.</Notice>
            <Button title={`Open ${done.ownerName}’s family view`} onPress={() => router.replace(`/family/of/${done.profileId}` as Href)} />
          </>
        ) : (
          <>
            {error && <ErrorState message={error} />}
            <Button title="Accept invitation" size="lg" onPress={accept} loading={busy} full />
          </>
        )}
    </Screen>
  );
}
