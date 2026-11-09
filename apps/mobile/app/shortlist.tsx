import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Stack } from 'expo-router';
import type { ShortlistItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { keys, useQuery } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Badge, EmptyState, ErrorState, Loading, Text } from '@/components/ui';
import { ProfileCardView } from '@/components/domain/ProfileCardView';
import { PrimaryAction, ShortlistButton } from '@/components/domain/ProfileActions';

export default function Shortlist() {
  const q = useQuery({ queryKey: keys.shortlist, queryFn: () => api.get<ShortlistItem[]>('/shortlist') });
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Shortlist' }} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(i) => i.profile.id}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, flexGrow: 1 }}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        renderItem={({ item }) => (
          <View style={{ gap: 6 }}>
            {item.addedByFamily && <Badge label="Added by family" tone="info" />}
            {item.note && <Text variant="small">“{item.note}”</Text>}
            <ProfileCardView card={item.profile} compact actions={<><PrimaryAction card={item.profile} size="sm" /><ShortlistButton card={item.profile} /></>} />
          </View>
        )}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : <EmptyState title="Your shortlist is empty" description="Bookmark profiles you’d like to revisit." />}
      />
    </View>
  );
}
