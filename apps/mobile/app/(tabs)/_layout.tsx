import * as React from 'react';
import { Pressable, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import { useMe } from '@/hooks/queries';
import { colors, fonts } from '@/theme';
import { Avatar, Icon } from '@/components/ui';

function HeaderRight() {
  const me = useMe();
  const unread = me.data?.unreadNotifications ?? 0;
  const name = me.data?.profile?.firstName ?? 'Me';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 12 }}>
      <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel={`Notifications${unread ? `, ${unread} unread` : ''}`} hitSlop={8} style={{ padding: 8 }}>
        <Icon name="bell" />
        {unread > 0 && <View style={{ position: 'absolute', right: 8, top: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.burgundy600 }} />}
      </Pressable>
      <Pressable onPress={() => router.push('/me')} accessibilityRole="button" accessibilityLabel="My profile and settings" hitSlop={8}>
        <Avatar uri={me.data?.profile?.primaryPhotoUrl} name={name} size={32} />
      </Pressable>
    </View>
  );
}

const icon = (name: string) => ({ color, focused }: { color: unknown; focused: boolean }) => <Icon name={name} color={String(color)} strokeWidth={focused ? 2.2 : 1.8} />;

export default function TabsLayout() {
  const me = useMe();
  const flags = me.data?.featureFlags ?? {};
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
        headerTitleAlign: 'left',
        headerRight: () => <HeaderRight />,
        tabBarActiveTintColor: colors.burgundy600,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'For you', tabBarIcon: icon('sparkles') }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('compass') }} />
      <Tabs.Screen name="matchmaker" options={{ title: 'Matchmaker', tabBarIcon: icon('chat'), href: flags.ai_matchmaker === false ? null : undefined }} />
      <Tabs.Screen name="interests" options={{ title: 'Interests', tabBarIcon: icon('heart') }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: icon('messages') }} />
    </Tabs>
  );
}
