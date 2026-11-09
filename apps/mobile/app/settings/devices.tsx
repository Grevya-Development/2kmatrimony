import * as React from 'react';
import { Alert, View } from 'react-native';
import { relativeTime, type DeviceItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { useQuery } from '@/hooks/queries';
import { space } from '@/theme';
import { Badge, Button, Card, EmptyState, ErrorState, Loading, Screen, Text } from '@/components/ui';

export default function Devices() {
  const q = useQuery({ queryKey: ['devices'], queryFn: () => api.get<DeviceItem[]>('/devices') });
  const revoke = (d: DeviceItem) => Alert.alert('Remove this device?', 'It will stop receiving notifications.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => { try { await api.del(`/devices/${d.id}`); void q.refetch(); } catch (e) { Alert.alert('Error', errorMessage(e)); } } },
  ]);
  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (q.data ?? []).length === 0 ? <EmptyState title="No devices registered" /> : (q.data ?? []).map((d) => (
        <Card key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="label">{d.deviceName ?? d.platform}</Text>
            <Text variant="small">{d.platform} · last seen {relativeTime(d.lastSeenAt)}{d.appVersion ? ` · v${d.appVersion}` : ''}</Text>
            {d.hasPush && <Badge label="Push enabled" tone="success" />}
          </View>
          <Button title="Remove" size="sm" variant="secondary" onPress={() => revoke(d)} />
        </Card>
      ))}
      <Text variant="small">To sign out everywhere, remove devices here and change your password or re-verify your phone.</Text>
    </Screen>
  );
}
