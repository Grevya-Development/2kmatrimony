import * as React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { router, Stack, type Href } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { relativeTime, type NotificationItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { hrefToRoute } from '@/lib/deeplinks';
import { keys, useQueryClient } from '@/hooks/queries';
import { colors, fonts, space } from '@/theme';
import { Button, EmptyState, ErrorState, Loading, Text } from '@/components/ui';

export default function Notifications() {
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: keys.notifications,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.request<NotificationItem[]>('/notifications', { query: { cursor: pageParam, limit: 30 } }),
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const markRead = async (ids?: string[]) => {
    await api.post('/notifications/read', ids ? { ids } : {}).catch(() => undefined);
    void q.refetch();
    void qc.invalidateQueries({ queryKey: keys.me });
  };
  const open = (n: NotificationItem) => {
    if (!n.readAt) void markRead([n.id]);
    const target = hrefToRoute(typeof n.data.href === 'string' ? n.data.href : null);
    if (target) router.push(target as Href);
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Notifications', headerRight: () => items.some((n) => !n.readAt) ? <Button title="Mark all read" size="sm" variant="ghost" onPress={() => markRead()} /> : null }} />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={`${item.readAt ? '' : 'Unread. '}${item.title}`} android_ripple={{ color: colors.line }}
            style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: item.readAt ? 'transparent' : colors.emerald600 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: item.readAt ? fonts.body : fonts.semibold }}>{item.title}</Text>
              {item.body && <Text variant="bodyMuted">{item.body}</Text>}
              <Text variant="small">{relativeTime(item.createdAt)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : <EmptyState title="Nothing new" description="Interests, connections and important updates will appear here." />}
      />
    </View>
  );
}
