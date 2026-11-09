import * as React from 'react';
import { router, Stack, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Per-weight imports keep unused font files out of the bundle.
import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond/500Medium';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient, restoreQueryCache } from '@/lib/query';
import { hrefToRoute } from '@/lib/deeplinks';
import { registerForPush } from '@/lib/push';
import { useMe } from '@/hooks/queries';
import { BiometricGate } from '@/components/app/LockScreen';
import { colors, fonts } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const PUBLIC_SEGMENTS = new Set(['(auth)', 'auth', 'family']);

/** Session- and onboarding-aware routing. */
function Gate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const me = useMe();
  const first = segments[0] ?? '';
  const inPublic = PUBLIC_SEGMENTS.has(first);
  const inOnboarding = first === 'onboarding';

  React.useEffect(() => {
    if (loading) return;
    if (!session) {
      if (!inPublic) router.replace('/sign-in');
      return;
    }
    if (!me.data) return;
    if (me.data.user.status === 'suspended') {
      if (first !== 'support' && first !== 'settings') router.replace('/support');
      return;
    }
    const helperOnly = !me.data.profile && me.data.familyOf.length > 0 && me.data.consentsRequired.length === 0;
    if (helperOnly) {
      // Family helpers may not have a profile of their own; they use the family view.
      if (first !== 'family' && !inOnboarding) router.replace(`/family/of/${me.data.familyOf[0]!.profileId}` as Href);
      return;
    }
    const needsOnboarding = !me.data.profile || me.data.profile.status === 'draft' || me.data.consentsRequired.length > 0;
    if (needsOnboarding && !inOnboarding && first !== 'family') router.replace('/onboarding');
    else if (!needsOnboarding && (first === '(auth)' || inOnboarding)) router.replace('/');
  }, [loading, session, me.data, inPublic, inOnboarding, first]);

  // Push registration + notification taps once signed in with a profile.
  React.useEffect(() => {
    if (!session || !me.data?.profile) return;
    registerForPush().catch((e) => console.warn('[push] registration failed', e));
    const open = (data: Record<string, unknown> | undefined) => {
      const target = hrefToRoute(typeof data?.href === 'string' ? data.href : null);
      if (target) router.push(target as Href);
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data as Record<string, unknown>));
    Notifications.getLastNotificationResponseAsync().then((r) => r && open(r.notification.request.content.data as Record<string, unknown>)).catch(() => undefined);
    return () => sub.remove();
  }, [session, me.data?.profile]);

  return <BiometricGate active={!!session}>{children}</BiometricGate>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ CormorantGaramond_500Medium, CormorantGaramond_600SemiBold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const [cacheReady, setCacheReady] = React.useState(false);

  React.useEffect(() => { restoreQueryCache().finally(() => setCacheReady(true)); }, []);
  React.useEffect(() => { if (fontsLoaded && cacheReady) void SplashScreen.hideAsync().catch(() => undefined); }, [fontsLoaded, cacheReady]);
  if (!fontsLoaded || !cacheReady) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Gate>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.canvas },
                headerShadowVisible: false,
                headerTintColor: colors.ink,
                headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16 },
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.canvas },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/index" options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
              <Stack.Screen name="member/[id]" options={{ title: '' }} />
              <Stack.Screen name="chat/[id]" options={{ title: '' }} />
            </Stack>
          </Gate>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
