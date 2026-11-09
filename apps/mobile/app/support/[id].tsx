import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { relativeTime } from '@2k/shared';
import { api, ApiClientError, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { CATEGORY_LABELS, STATUS_META, canReply, type TicketThread } from '@/lib/support';
import { useQuery } from '@/hooks/queries';
import { colors, radius, space } from '@/theme';
import { Badge, Button, ErrorState, Loading, Notice, Text, TextField } from '@/components/ui';

export default function SupportThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['support-ticket', id], queryFn: () => api.get<TicketThread>(`/support/tickets/${id}`) });
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scroll = React.useRef<React.ComponentRef<typeof ScrollView>>(null);

  const reply = async () => {
    setBusy(true); setError(null);
    try {
      await api.post(`/support/tickets/${id}`, { body: body.trim() });
      haptic.success(); setBody('');
      await q.refetch();
      void qc.invalidateQueries({ queryKey: ['support-tickets'] });
      requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setError(e instanceof ApiClientError && e.status === 409 ? 'This request is closed. Please start a new one.' : errorMessage(e));
    } finally { setBusy(false); }
  };

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) {
    const gone = q.error instanceof ApiClientError && q.error.status === 404;
    return <View style={{ padding: space.lg }}><ErrorState message={gone ? 'This request could not be found.' : errorMessage(q.error)} onRetry={gone ? undefined : () => q.refetch()} /></View>;
  }
  const { ticket, messages } = q.data;
  const meta = STATUS_META[ticket.status];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: ticket.subject }} />
      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge label={meta.label} tone={meta.tone} />
          <Text variant="small">{CATEGORY_LABELS[ticket.category] ?? ticket.category} · opened {relativeTime(ticket.created_at)}</Text>
        </View>
        {ticket.status === 'pending_user' && <Notice tone="warning">Our team replied and is waiting for you.</Notice>}
        {messages.map((m) => (
          <View key={m.id} style={{ alignSelf: m.is_staff ? 'flex-start' : 'flex-end', maxWidth: '88%', gap: 2 }}>
            <View style={{ backgroundColor: m.is_staff ? colors.surface : colors.emerald600, borderWidth: m.is_staff ? 1 : 0, borderColor: colors.line, borderRadius: radius.lg, padding: space.md }}>
              <Text style={{ color: m.is_staff ? colors.ink : colors.white }}>{m.body}</Text>
            </View>
            <Text variant="small" style={{ textAlign: m.is_staff ? 'left' : 'right' }}>{m.is_staff ? '2K Marriage support' : 'You'} · {relativeTime(m.created_at)}</Text>
          </View>
        ))}
        {canReply(ticket.status) ? (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <TextField label={ticket.status === 'resolved' ? 'Reply to reopen' : 'Reply'} multiline maxLength={5000} value={body} onChangeText={setBody} />
            {error && <ErrorState message={error} />}
            <Button title="Send reply" onPress={reply} loading={busy} disabled={!body.trim()} />
          </View>
        ) : <Notice>This request is closed. Start a new request if you need more help.</Notice>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
