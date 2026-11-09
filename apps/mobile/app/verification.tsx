import * as React from 'react';
import { Alert, View } from 'react-native';
import { Stack } from 'expo-router';
import { ID_DOCUMENT_TYPES, VERIFICATION_KIND_LABELS, type VerificationItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { pickImage, uploadAsset } from '@/lib/upload';
import { haptic } from '@/lib/haptics';
import { useQuery } from '@/hooks/queries';
import { space } from '@/theme';
import { Badge, Button, Card, ChipGroup, ErrorState, Loading, Notice, Screen, Text } from '@/components/ui';

const TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { approved: 'success', pending: 'warning', in_review: 'info', rejected: 'danger', resubmission_required: 'danger', expired: 'neutral', not_started: 'neutral' };
const DOC_LABEL: Record<string, string> = { aadhaar_masked: 'Masked Aadhaar', passport: 'Passport', driving_licence: 'Driving licence', pan: 'PAN card', voter_id: 'Voter ID' };

export default function Verification() {
  const q = useQuery({ queryKey: ['verification'], queryFn: () => api.get<VerificationItem[]>('/verification') });
  const [docType, setDocType] = React.useState<string[]>(['aadhaar_masked']);
  const [busy, setBusy] = React.useState<string | null>(null);

  const submit = async (kind: 'government_id' | 'photo' | 'employment', source: 'camera' | 'library') => {
    const asset = await pickImage(source);
    if (!asset) return;
    setBusy(kind);
    try {
      const up = await uploadAsset('verification', asset);
      await api.post('/verification', { kind, documentType: kind === 'government_id' ? docType[0] : kind === 'employment' ? 'employee_id' : undefined, documentPaths: [up.path], submittedData: {} });
      haptic.success();
      Alert.alert('Submitted', 'Our team will review it shortly. We’ll notify you of the result.');
      void q.refetch();
    } catch (e) { Alert.alert('Not submitted', errorMessage(e)); } finally { setBusy(null); }
  };

  const item = (k: string) => q.data?.find((v) => v.kind === k);
  const canSubmit = (k: string) => { const s = item(k)?.status ?? 'not_started'; return s === 'not_started' || s === 'rejected' || s === 'resubmission_required' || s === 'expired'; };

  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: 'Verification' }} />
      <Notice>Verified badges confirm specific checks. Everything else on a profile is the member’s own statement. Documents are stored privately and only reviewed by authorised staff.</Notice>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (
        <>
          {(q.data ?? []).map((v) => (
            <Card key={v.kind} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="label">{VERIFICATION_KIND_LABELS[v.kind]}</Text>
                <Badge label={v.status.replace(/_/g, ' ')} tone={TONE[v.status] ?? 'neutral'} />
              </View>
              {v.rejectionReason && <Text variant="small">Reason: {v.rejectionReason}</Text>}
            </Card>
          ))}
          <Card style={{ gap: space.md }}>
            <Text variant="heading">Government ID</Text>
            <Text variant="small">Use a masked Aadhaar (only last 4 digits visible) or another ID. Never upload full Aadhaar numbers.</Text>
            <ChipGroup label="Document type" options={ID_DOCUMENT_TYPES.map((d) => ({ value: d, label: DOC_LABEL[d] ?? d }))} value={docType} onChange={setDocType} />
            {canSubmit('government_id') ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Take photo" size="sm" onPress={() => submit('government_id', 'camera')} loading={busy === 'government_id'} />
                <Button title="Choose file" size="sm" variant="secondary" onPress={() => submit('government_id', 'library')} />
              </View>
            ) : <Text variant="small">Submitted — status shown above.</Text>}
          </Card>
          <Card style={{ gap: space.md }}>
            <Text variant="heading">Photo verification</Text>
            <Text variant="small">Take a clear selfie so we can confirm your profile photos are you.</Text>
            {canSubmit('photo') ? <Button title="Take a selfie" size="sm" onPress={() => submit('photo', 'camera')} loading={busy === 'photo'} /> : <Text variant="small">Submitted — status shown above.</Text>}
          </Card>
          <Card style={{ gap: space.md }}>
            <Text variant="heading">Employment (optional)</Text>
            <Text variant="small">An employee ID card or offer letter. Hide salary figures if you prefer.</Text>
            {canSubmit('employment') ? <Button title="Upload document" size="sm" variant="secondary" onPress={() => submit('employment', 'library')} loading={busy === 'employment'} /> : <Text variant="small">Submitted — status shown above.</Text>}
          </Card>
        </>
      )}
    </Screen>
  );
}
