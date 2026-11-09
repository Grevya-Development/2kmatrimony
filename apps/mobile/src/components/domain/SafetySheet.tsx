import * as React from 'react';
import { Alert } from 'react-native';
import { REPORT_REASON_OPTIONS, type ReportReason } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { Button, ChipGroup, ErrorState, Notice, Sheet, Text, TextField } from '@/components/ui';

/** Report and/or block a member (or a specific message). */
export function SafetySheet({ visible, onClose, profileId, messageId, name, onBlocked }: {
  visible: boolean; onClose: () => void; profileId: string; messageId?: string; name: string; onBlocked?: () => void;
}) {
  const [reason, setReason] = React.useState<ReportReason[]>([]);
  const [details, setDetails] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const report = async () => {
    if (!reason[0]) return setError('Choose a reason.');
    setBusy(true); setError(null);
    try {
      await api.post('/reports', { targetProfileId: profileId, targetMessageId: messageId, reason: reason[0], details: details.trim() || null });
      haptic.success();
      setDone(true);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  const block = () => {
    Alert.alert(`Block ${name}?`, 'They won’t be able to see your profile or contact you, and you won’t see them.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => {
        try { await api.post('/blocks', { targetProfileId: profileId }); haptic.warning(); onBlocked?.(); onClose(); }
        catch (e) { setError(errorMessage(e)); }
      } },
    ]);
  };

  return (
    <Sheet visible={visible} onClose={() => { onClose(); setDone(false); setReason([]); setDetails(''); }} title="Safety">
      {done ? (
        <Notice tone="success">Thank you. Our trust & safety team will review this report. You can also block {name} to stop all contact.</Notice>
      ) : (
        <>
          <Text variant="bodyMuted">Reports are confidential. {name} won’t know who reported them.</Text>
          <ChipGroup label="Reason" options={REPORT_REASON_OPTIONS} value={reason} onChange={setReason} />
          <TextField label="Details" optional multiline value={details} onChangeText={setDetails} maxLength={2000} placeholder="What happened?" />
          {error && <ErrorState message={error} />}
          <Button title="Send report" onPress={report} loading={busy} full />
        </>
      )}
      <Button title={`Block ${name}`} variant="secondary" onPress={block} full />
    </Sheet>
  );
}
