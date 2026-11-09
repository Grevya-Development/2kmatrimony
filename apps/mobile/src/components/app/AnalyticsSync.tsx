import * as React from 'react';
import { Alert } from 'react-native';
import { usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { analyticsConfigured, identifyMember, setAnalyticsConsent, trackScreen } from '@/lib/analytics';
import { useMe } from '@/hooks/queries';

const ASKED_KEY = 'tk_analytics_prompted';

/**
 * Applies the member's server-side analytics consent, asks once (native alert)
 * when undecided, identifies with the pseudonymous id, and records screens.
 */
export function AnalyticsSync() {
  const me = useMe();
  const pathname = usePathname();
  const qc = useQueryClient();
  const consent = me.data?.analyticsConsent ?? null;

  React.useEffect(() => {
    if (!analyticsConfigured() || !me.data) return;
    if (consent !== null) {
      void setAnalyticsConsent(consent).then(() => {
        if (consent) identifyMember(me.data!.user.id, { plan: me.data!.plan.code, profile_status: me.data!.profile?.status ?? 'none' });
      });
      return;
    }
    void (async () => {
      if (await AsyncStorage.getItem(ASKED_KEY)) return;
      await AsyncStorage.setItem(ASKED_KEY, '1');
      const decide = async (granted: boolean) => {
        try { await api.post('/settings/consents', { consentType: 'product_analytics', granted }); } catch { /* retried via Settings */ }
        await setAnalyticsConsent(granted);
        void qc.invalidateQueries({ queryKey: ['me'] });
      };
      Alert.alert(
        'Help us improve 2K Marriage?',
        'With your permission we use anonymous usage analytics — screens visited and features used. Never your name, contact details, profile or messages. You can change this anytime in Settings.',
        [
          { text: 'No thanks', style: 'cancel', onPress: () => void decide(false) },
          { text: 'Allow', onPress: () => void decide(true) },
        ],
      );
    })();
  }, [consent, me.data, qc]);

  React.useEffect(() => {
    if (pathname) trackScreen(pathname);
  }, [pathname]);

  return null;
}
