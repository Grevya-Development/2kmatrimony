import * as React from 'react';
import { Alert, Linking } from 'react-native';
import type { DataRequestItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/hooks/queries';
import { space } from '@/theme';
import { Badge, Button, Card, ErrorState, Notice, Screen, Section, Text, TextField } from '@/components/ui';

export default function DataScreen() {
  const { signOut } = useAuth();
  const requests = useQuery({ queryKey: ['data-requests'], queryFn: () => api.get<DataRequestItem[]>('/privacy/requests') });
  const [confirm, setConfirm] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const pendingDeletion = (requests.data ?? []).find((r) => r.kind === 'deletion' && r.status === 'pending');

  const exportData = async () => {
    setBusy('export'); setError(null);
    try {
      const r = await api.post<{ url?: string; expiresAt?: string }>('/privacy/export', {});
      void requests.refetch();
      if (r.url) Alert.alert('Your export is ready', `The download link expires ${r.expiresAt ? new Date(r.expiresAt).toLocaleString('en-IN') : 'soon'}.`, [{ text: 'Later', style: 'cancel' }, { text: 'Open', onPress: () => void Linking.openURL(r.url!) }]);
      else Alert.alert('Export requested', 'We’ll notify you when it’s ready.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };
  const scheduleDeletion = async () => {
    setBusy('delete'); setError(null);
    try {
      const r = await api.post<{ scheduledFor: string }>('/privacy/deletion', { confirm: 'DELETE', reason: reason.trim() || null });
      Alert.alert('Deletion scheduled', `Your account will be deleted on ${new Date(r.scheduledFor).toLocaleDateString('en-IN')}. Sign in before then to cancel.`, [{ text: 'OK', onPress: () => void signOut() }]);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };
  const cancelDeletion = async () => {
    try { await api.del('/privacy/deletion'); void requests.refetch(); Alert.alert('Deletion cancelled', 'Your account will stay active.'); } catch (e) { setError(errorMessage(e)); }
  };

  return (
    <Screen edges={[]} keyboardShouldPersistTaps="handled">
      {error && <ErrorState message={error} />}
      <Section title="Download your data">
        <Text variant="bodyMuted">Get a copy of your profile, preferences, connections and messages as a JSON file.</Text>
        <Button title="Request export" variant="secondary" onPress={exportData} loading={busy === 'export'} />
      </Section>
      {(requests.data ?? []).length > 0 && (
        <Section title="Requests">
          {(requests.data ?? []).map((r) => (
            <Card key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>{r.kind === 'export' ? 'Data export' : r.kind === 'deletion' ? 'Account deletion' : 'Correction'}{r.scheduledFor ? ` · ${new Date(r.scheduledFor).toLocaleDateString('en-IN')}` : ''}</Text>
              <Badge label={r.status} tone={r.status === 'completed' ? 'success' : r.status === 'pending' ? 'warning' : 'neutral'} />
            </Card>
          ))}
        </Section>
      )}
      <Section title="Delete your account">
        {pendingDeletion ? (
          <>
            <Notice tone="warning">Deletion is scheduled for {pendingDeletion.scheduledFor ? new Date(pendingDeletion.scheduledFor).toLocaleDateString('en-IN') : 'soon'}.</Notice>
            <Button title="Cancel deletion" onPress={cancelDeletion} />
          </>
        ) : (
          <Card style={{ gap: space.md }}>
            <Text variant="bodyMuted">Your profile is hidden immediately and permanently deleted after a short grace period. This can’t be undone after that.</Text>
            <TextField label="Why are you leaving?" optional value={reason} onChangeText={setReason} maxLength={500} />
            <TextField label="Type DELETE to confirm" autoCapitalize="characters" value={confirm} onChangeText={setConfirm} />
            <Button title="Delete my account" variant="danger" onPress={scheduleDeletion} loading={busy === 'delete'} disabled={confirm !== 'DELETE'} />
          </Card>
        )}
      </Section>
    </Screen>
  );
}
