import * as React from 'react';
import { FlatList, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { relativeTime, type InterestItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { keys } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Badge, EmptyState, ErrorState, Loading, OfflineBanner, SegmentedControl, Text } from '@/components/ui';
import { ProfileCardView } from '@/components/domain/ProfileCardView';
import { PrimaryAction } from '@/components/domain/ProfileActions';

type Dir = 'received' | 'sent';
const TONE = { pending: 'champagne', accepted: 'success', declined: 'neutral', withdrawn: 'neutral', expired: 'neutral' } as const;

export default function Interests() {
  const [dir, setDir] = React.useState<Dir>('received');
  const q = useInfiniteQuery({
    queryKey: keys.interests(dir),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.request<InterestItem[]>('/interests', { query: { direction: dir, cursor: pageParam, limit: 20 } }),
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <OfflineBanner />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 80 }}
        ListHeaderComponent={<SegmentedControl label="Interest direction" value={dir} onChange={setDir} options={[{ value: 'received', label: 'Received' }, { value: 'sent', label: 'Sent' }]} />}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        renderItem={({ item }) => (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge label={item.status} tone={TONE[item.status]} />
              <Text variant="small">{relativeTime(item.createdAt)}</Text>
            </View>
            {item.message && <Text variant="bodyMuted" style={{ fontStyle: 'italic' }}>“{item.message}”</Text>}
            <ProfileCardView card={item.profile} compact actions={<PrimaryAction card={item.profile} size="sm" />} />
          </View>
        )}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
          : <EmptyState title={dir === 'received' ? 'No interests yet' : 'You haven’t sent any interests'} description={dir === 'received' ? 'A complete profile with photos helps the right people find you.' : 'Express interest from For you or Discover when someone feels right.'} />}
      />
    </View>
  );
}
