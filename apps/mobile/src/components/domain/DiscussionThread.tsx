import * as React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { relativeTime, type FamilyDiscussionItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme';
import { Button, ErrorState, Loading, Text, TextField } from '@/components/ui';

/**
 * Private family discussion about one profile. `ownerProfileId` is required for
 * family members; owners omit it (the API defaults to their own profile).
 */
export function DiscussionThread({ ownerProfileId, targetProfileId }: { ownerProfileId?: string; targetProfileId: string }) {
  const q = useQuery({
    queryKey: ['family-discussion', ownerProfileId ?? 'own', targetProfileId],
    queryFn: () => api.get<FamilyDiscussionItem[]>('/family/discussions', { profileId: ownerProfileId, targetProfileId }),
  });
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true); setError(null);
    try {
      await api.post('/family/discussions', { ...(ownerProfileId ? { profileId: ownerProfileId } : {}), targetProfileId, body: text });
      setBody(''); haptic.tap(); void q.refetch();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <View style={{ gap: space.sm }}>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (q.data ?? []).length === 0
        ? <Text variant="small">No messages yet. Share your thoughts about this introduction.</Text>
        : (q.data ?? []).map((m) => (
          <View key={m.id} style={{ alignSelf: m.isMine ? 'flex-end' : 'flex-start', maxWidth: '88%', gap: 2 }}>
            <View style={{ backgroundColor: m.isMine ? colors.emerald600 : colors.surface2, borderRadius: radius.lg, padding: space.md }}>
              <Text style={{ color: m.isMine ? colors.white : colors.ink }}>{m.body}</Text>
            </View>
            <Text variant="small" style={{ textAlign: m.isMine ? 'right' : 'left' }}>{m.isMine ? 'You' : m.authorName}{m.isOwner && !m.isMine ? ' (profile owner)' : ''} · {relativeTime(m.createdAt)}</Text>
          </View>
        ))}
      <TextField label="Add to the discussion" multiline maxLength={2000} value={body} onChangeText={setBody} />
      {error && <ErrorState message={error} />}
      <Button title="Send" size="sm" onPress={send} loading={busy} disabled={!body.trim()} />
    </View>
  );
}
