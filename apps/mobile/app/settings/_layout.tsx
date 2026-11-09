import { Stack } from 'expo-router';
import { colors, fonts } from '@/theme';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.canvas }, headerShadowVisible: false, headerTintColor: colors.ink, headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16 }, contentStyle: { backgroundColor: colors.canvas }, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'Settings & privacy' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notification preferences' }} />
      <Stack.Screen name="devices" options={{ title: 'Devices' }} />
      <Stack.Screen name="data" options={{ title: 'Your data' }} />
    </Stack>
  );
}
