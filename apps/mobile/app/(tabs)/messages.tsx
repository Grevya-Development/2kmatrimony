import * as React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { relativeTime, type ConversationItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { keys, useQuery } from '@/hooks/queries';
import { colors, fonts, space } from '@/theme';
import { Avatar, EmptyState, ErrorState, Loading, OfflineBanner, Text } from '@/components/ui';

export default function Messages() {
  const q = useQuery({ queryKey: keys.conversations, queryFn: () => api.get<ConversationItem[]>('/conversations'), refetchInterval: 30_000 });
  const items = (q.data ?? []).filter((c) => !c.archived);
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <OfflineBanner />
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        contentContainerStyle={{ padding: space.lg, gap: 2, flexGrow: 1 }}
        ListHeaderComponent={<Pressable onPress={() => router.push('/connections')} accessibilityRole="link" style={{ paddingBottom: space.md }}><Text style={{ color: colors.emerald600, fontFamily: fonts.medium }}>View all connections</Text></Pressable>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/chat/${item.id}` as Href)}
            accessibilityRole="button"
            accessibilityLabel={`${item.other.displayName}. ${item.unreadCount ? `${item.unreadCount} unread. ` : ''}${item.lastMessagePreview ?? 'No messages yet'}`}
            android_ripple={{ color: colors.line }}
            style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line }}
          >
            <Avatar uri={item.other.photoUrl} name={item.other.displayName} size={52} blurred={item.other.photoBlurred} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="label" style={{ color: colors.ink, fontFamily: item.unreadCount ? fonts.semibold : fonts.medium }}>{item.other.displayName}{item.muted ? '  ·  muted' : ''}</Text>
                {item.lastMessageAt && <Text variant="small">{relativeTime(item.lastMessageAt)}</Text>}
              </View>
              <Text variant="bodyMuted" numberOfLines={1} style={item.unreadCount ? { color: colors.ink } : undefined}>{item.isLocked ? 'Conversation closed' : item.lastMessagePreview ?? 'Say hello 👋'}</Text>
            </View>
            {item.unreadCount > 0 && <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.emerald600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ color: colors.white, fontSize: 12, fontFamily: fonts.semibold }}>{item.unreadCount}</Text></View>}
          </Pressable>
        )}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
          : <EmptyState title="No conversations yet" description="When someone accepts your interest — or you accept theirs — you can talk here." />}
      />
    </View>
  );
}
