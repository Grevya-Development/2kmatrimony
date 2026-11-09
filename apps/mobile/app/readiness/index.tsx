import * as React from 'react';
import { Pressable, View } from 'react-native';
import { router, Stack, type Href } from 'expo-router';
import { READINESS_TOPICS, READINESS_TOPIC_LABELS, type ReadinessNote } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { useQuery } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Badge, ErrorState, Icon, Loading, Notice, Screen, Text } from '@/components/ui';

export interface ReadinessState { notes: ReadinessNote[]; aiAvailable: boolean; consentGranted: boolean }

/** Private space to think through marriage topics before discussing them with a partner. */
export default function Readiness() {
  const q = useQuery({ queryKey: ['readiness'], queryFn: () => api.get<ReadinessState>('/readiness') });
  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: 'Readiness assistant' }} />
      <Text variant="bodyMuted">Explore important topics privately, note your own view and the questions you’d like to ask. This is a thinking space — it never judges whether anyone is “ready”.</Text>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (
        <>
          {!q.data?.aiAvailable && <Notice>AI discussion is unavailable right now — you can still keep private notes.</Notice>}
          {q.data?.aiAvailable && !q.data.consentGranted && <Notice tone="warning">Turn on “AI matchmaking features” in Settings to use the discussion assistant.</Notice>}
          <View>
            {READINESS_TOPICS.map((t) => {
              const note = q.data?.notes.find((n) => n.topic === t);
              const has = !!(note?.myView || note?.questionsToAsk.length);
              return (
                <Pressable key={t} onPress={() => router.push(`/readiness/${t}` as Href)} accessibilityRole="link" android_ripple={{ color: colors.line }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <Text style={{ flex: 1 }}>{READINESS_TOPIC_LABELS[t]}</Text>
                  {has && <Badge label="Notes" tone="champagne" />}
                  {note?.exploredAt && <Badge label="Explored" tone="success" />}
                  <Icon name="chevron-right" size={18} color={colors.muted} />
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}
