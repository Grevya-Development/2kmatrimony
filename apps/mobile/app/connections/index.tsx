import * as React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { router, Stack, type Href } from 'expo-router';
import { relativeTime, type ConnectionItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { keys, useQuery } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Avatar, EmptyState, ErrorState, Icon, Loading, Text } from '@/components/ui';

export default function Connections() {
  const q = useQuery({ queryKey: keys.connections, queryFn: () => api.get<ConnectionItem[]>('/connections') });
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Connections' }} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/connections/${item.id}` as Href)} accessibilityRole="button" accessibilityLabel={`${item.profile.displayName}, connected ${relativeTime(item.createdAt)}`} android_ripple={{ color: colors.line }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Avatar uri={item.profile.photoUrl} name={item.profile.displayName} size={52} />
            <View style={{ flex: 1 }}>
              <Text variant="label" style={{ color: colors.ink }}>{item.profile.displayName}</Text>
              <Text variant="small">Connected {relativeTime(item.createdAt)}{item.unreadCount ? ` · ${item.unreadCount} unread` : ''}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : <EmptyState title="No connections yet" description="When interest is mutual, you’ll find each other here — with private tools to get to know one another." />}
      />
    </View>
  );
}
