import * as React from 'react';
import { Alert, View } from 'react-native';
import { NOTIFICATION_CATEGORIES, type NotificationCategory, type NotificationChannel } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { useQuery } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Card, ErrorState, Loading, Screen, Switch, Text } from '@/components/ui';

interface Pref { category: NotificationCategory; channel: NotificationChannel; enabled: boolean; locked?: boolean }
const CHANNELS: NotificationChannel[] = ['push', 'email', 'sms', 'whatsapp'];
const CAT_LABEL: Record<NotificationCategory, string> = { interests: 'Interests', connections: 'Connections', messages: 'Messages', recommendations: 'Daily matches', verification: 'Verification', billing: 'Billing', family: 'Family', product_updates: 'Product updates', security: 'Security' };

export default function NotificationPrefs() {
  const q = useQuery({ queryKey: ['notification-prefs'], queryFn: () => api.get<Pref[]>('/settings/notifications') });
  const [prefs, setPrefs] = React.useState<Pref[]>([]);
  React.useEffect(() => { if (q.data) setPrefs(q.data); }, [q.data]);
  const toggle = async (p: Pref, enabled: boolean) => {
    setPrefs((all) => all.map((x) => (x.category === p.category && x.channel === p.channel ? { ...x, enabled } : x)));
    try { await api.put('/settings/notifications', { preferences: [{ category: p.category, channel: p.channel, enabled }] }); }
    catch (e) { Alert.alert('Not saved', errorMessage(e)); void q.refetch(); }
  };
  if (q.isLoading) return <Screen edges={[]}><Loading /></Screen>;
  if (q.error) return <Screen edges={[]}><ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /></Screen>;
  return (
    <Screen edges={[]}>
      <Text variant="bodyMuted">In-app notifications are always on. Choose how else we reach you.</Text>
      {NOTIFICATION_CATEGORIES.map((cat) => (
        <Card key={cat} style={{ gap: space.sm }}>
          <Text variant="heading" style={{ fontSize: 19 }}>{CAT_LABEL[cat]}</Text>
          {CHANNELS.map((ch) => {
            const p = prefs.find((x) => x.category === cat && x.channel === ch);
            if (!p) return null;
            return (
              <View key={ch} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text>{ch === 'sms' ? 'SMS' : ch === 'whatsapp' ? 'WhatsApp' : ch.charAt(0).toUpperCase() + ch.slice(1)}</Text>
                <Switch accessibilityLabel={`${CAT_LABEL[cat]} via ${ch}`} value={p.enabled} disabled={p.locked} onValueChange={(v) => toggle(p, v)} trackColor={{ true: colors.burgundy500, false: colors.lineStrong }} />
              </View>
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}
