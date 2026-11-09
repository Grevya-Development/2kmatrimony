import * as React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import type { RecommendationItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { keys, useMe, useQuery, useQueryClient } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Button, EmptyState, ErrorState, IconButton, Icon, Notice, OfflineBanner, Skeleton, Text } from '@/components/ui';
import { ProfileCardView } from '@/components/domain/ProfileCardView';
import { PrimaryAction, ShortlistButton, handleEntitlementError } from '@/components/domain/ProfileActions';
import { SafetySheet } from '@/components/domain/SafetySheet';

export default function ForYou() {
  const qc = useQueryClient();
  const me = useMe();
  const recs = useQuery({ queryKey: keys.recommendations, queryFn: () => api.get<RecommendationItem[]>('/recommendations') });
  const [undo, setUndo] = React.useState<RecommendationItem | null>(null);
  const [safety, setSafety] = React.useState<RecommendationItem | null>(null);
  const items = (recs.data ?? []).filter((r) => r.status !== 'passed' && !r.profile.relationship.passed);

  const pass = async (item: RecommendationItem) => {
    haptic.tap();
    qc.setQueryData<RecommendationItem[]>(keys.recommendations, (old) => old?.map((r) => (r.id === item.id ? { ...r, status: 'passed' } : r)));
    setUndo(item);
    try { await api.post(`/recommendations/${item.id}`, { action: 'passed' }); }
    catch (e) { if (!handleEntitlementError(e)) setUndo(null); void recs.refetch(); }
  };
  const undoPass = async () => {
    if (!undo) return;
    const item = undo;
    setUndo(null);
    qc.setQueryData<RecommendationItem[]>(keys.recommendations, (old) => old?.map((r) => (r.id === item.id ? { ...item, status: 'viewed' } : r)));
    await api.del(`/passes/${item.profile.id}`).catch(() => undefined);
    void recs.refetch();
  };

  const header = (
    <View style={{ gap: 6, marginBottom: space.md }}>
      <Text variant="eyebrow">Today</Text>
      <Text variant="hero">Hello{me.data?.profile?.firstName ? `, ${me.data.profile.firstName}` : ''}</Text>
      <Text variant="bodyMuted">A few thoughtful matches, chosen because you align — in both directions.</Text>
      {me.data?.profile && me.data.profile.completionPct < 80 && (
        <Notice>Your profile is {me.data.profile.completionPct}% complete. <Text style={{ color: colors.info, textDecorationLine: 'underline' }} onPress={() => router.push('/me')}>Add more</Text> for better matches.</Notice>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <OfflineBanner />
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 100 }}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={recs.isRefetching} onRefresh={() => void recs.refetch()} tintColor={colors.burgundy600} />}
        ListEmptyComponent={
          recs.isLoading ? <View style={{ gap: space.md }}><Skeleton height={360} /><Skeleton height={20} width="60%" /></View>
          : recs.error ? <ErrorState message={errorMessage(recs.error)} onRetry={() => recs.refetch()} />
          : <EmptyState title="You’re all caught up" description="New matches arrive daily. Meanwhile, explore Discover or ask the Matchmaker." action={{ label: 'Discover', onPress: () => router.push('/discover') }} />
        }
        renderItem={({ item }) => (
          <View style={{ gap: 8 }}>
            {item.reason && <Text variant="small">{item.reason}</Text>}
            <ProfileCardView
              card={item.profile}
              actions={<>
                <PrimaryAction card={item.profile} size="sm" />
                <ShortlistButton card={item.profile} />
                <IconButton label={`Pass on ${item.profile.displayName}`} onPress={() => pass(item)}><Icon name="x" /></IconButton>
                <IconButton label="Report or block" onPress={() => setSafety(item)}><Icon name="more" /></IconButton>
              </>}
            />
          </View>
        )}
      />
      {undo && (
        <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, backgroundColor: colors.ink, borderRadius: 16, padding: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} accessibilityLiveRegion="polite">
          <Text style={{ color: colors.canvas }}>Passed on {undo.profile.displayName}</Text>
          <Button title="Undo" size="sm" variant="champagne" onPress={undoPass} />
        </View>
      )}
      {safety && <SafetySheet visible onClose={() => setSafety(null)} profileId={safety.profile.id} name={safety.profile.displayName} onBlocked={() => recs.refetch()} />}
    </View>
  );
}
