import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import type { ConsentState } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { biometricAvailable, isBiometricEnabled, setBiometricEnabled } from '@/lib/biometric';
import { useQuery } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Card, Icon, Screen, Section, Switch, Text } from '@/components/ui';

function Row({ label, href, icon }: { label: string; href: Href; icon: string }) {
  return (
    <Pressable onPress={() => router.push(href)} accessibilityRole="link" android_ripple={{ color: colors.line }} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Icon name={icon} size={20} /><Text style={{ flex: 1 }}>{label}</Text><Icon name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function Settings() {
  const { signOut } = useAuth();
  const [bio, setBio] = React.useState(false);
  const [bioAvailable, setBioAvailable] = React.useState(false);
  const consents = useQuery({ queryKey: ['consents'], queryFn: () => api.get<ConsentState[]>('/settings/consents') });

  React.useEffect(() => { isBiometricEnabled().then(setBio); biometricAvailable().then(setBioAvailable); }, []);

  const toggleBio = async (on: boolean) => {
    const ok = await setBiometricEnabled(on);
    if (ok) setBio(on); else Alert.alert('Biometric unlock unavailable', 'Set up Face ID, Touch ID or a fingerprint on this device first.');
  };
  const toggleConsent = async (c: ConsentState, granted: boolean) => {
    try { await api.post('/settings/consents', { consentType: c.consentType, granted }); void consents.refetch(); } catch (e) { Alert.alert('Error', errorMessage(e)); }
  };
  const optional = (consents.data ?? []).filter((c) => !c.required);
  const label = (t: string) => ({ ai_processing: 'AI matchmaking features', ai_message_analysis: 'AI analysis of messages (off by default)', family_access: 'Family collaboration', marketing_email: 'Marketing emails', marketing_sms: 'Marketing SMS', whatsapp: 'WhatsApp updates', identity_verification: 'Identity verification processing', data_sharing_partner: 'Sharing with partners' } as Record<string, string>)[t] ?? t;

  return (
    <Screen edges={[]}>
      <View>
        <Row label="Privacy controls" href="/settings/privacy" icon="lock" />
        <Row label="Notification preferences" href="/settings/notifications" icon="bell" />
        <Row label="Devices" href="/settings/devices" icon="settings" />
        <Row label="Download or delete your data" href="/settings/data" icon="shield" />
      </View>
      <Section title="Security">
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="label" style={{ color: colors.ink }}>Biometric unlock</Text>
            <Text variant="small">{bioAvailable ? 'Require Face ID / fingerprint when opening the app.' : 'Not available on this device.'}</Text>
          </View>
          <Switch accessibilityLabel="Biometric unlock" value={bio} disabled={!bioAvailable} onValueChange={toggleBio} trackColor={{ true: colors.burgundy500, false: colors.lineStrong }} />
        </Card>
      </Section>
      {optional.length > 0 && (
        <Section title="Consents">
          <Card style={{ gap: space.md }}>
            {optional.map((c) => (
              <View key={c.consentType} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Text style={{ flex: 1 }}>{label(c.consentType)}</Text>
                <Switch accessibilityLabel={label(c.consentType)} value={c.granted} onValueChange={(v) => toggleConsent(c, v)} trackColor={{ true: colors.burgundy500, false: colors.lineStrong }} />
              </View>
            ))}
          </Card>
        </Section>
      )}
      <Pressable onPress={() => void signOut()} accessibilityRole="button" style={{ paddingVertical: space.md }}><Text style={{ color: colors.burgundy600 }}>Sign out</Text></Pressable>
    </Screen>
  );
}
