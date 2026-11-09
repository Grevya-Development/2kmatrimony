import { Stack } from 'expo-router';
import { colors, fonts } from '@/theme';

export default function MeLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.canvas }, headerShadowVisible: false, headerTintColor: colors.ink, headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16 }, contentStyle: { backgroundColor: colors.canvas }, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'My profile', headerLargeTitle: true, headerLargeTitleStyle: { fontFamily: fonts.display } }} />
      <Stack.Screen name="dna" options={{ title: 'Relationship DNA' }} />
      <Stack.Screen name="edit/[section]" options={{ title: 'Edit' }} />
    </Stack>
  );
}
