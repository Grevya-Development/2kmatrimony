import * as React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import type { RecommendationItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { keys, useMe, useOwnProfile, useQuery, useQueryClient } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Button, EmptyState, ErrorState, IconButton, Icon, Notice, OfflineBanner, Skeleton, Text } from '@/components/ui';
import { ProfileCardView } from '@/components/domain/ProfileCardView';
import { PrimaryAction, ShortlistButton, handleEntitlementError } from '@/components/domain/ProfileActions';
import { SafetySheet } from '@/components/domain/SafetySheet';
import { ProfileChecklist } from '@/components/domain/ProfileChecklist';

export default function ForYou() {
  const qc = useQueryClient();
  const me = useMe();
  const own = useOwnProfile(!!me.data?.profile);
  const recs = useQuery({ queryKey: keys.recommendations, queryFn: () => api.get<RecommendationItem[]>('/recommendations'), enabled: me.data?.profile?.status === 'active' });
  const [undo, setUndo] = React.useState<RecommendationItem | null>(null);
  const [safety, setSafety] = React.useState<RecommendationItem | null>(null);
  const inReview = me.data?.profile?.status === 'in_review';
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
      <Text variant="bodyMuted">A few thoughtful introductions. Hand-picked ones from your matchmaker come first.</Text>
      {inReview && <Notice>Your profile is with our team for review — usually within 24 hours. We’ll notify you as soon as it’s live. Meanwhile, adding a few more details helps us find better matches.</Notice>}
      {me.data?.profile && <View style={{ marginTop: space.sm }}><ProfileChecklist /></View>}
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
        refreshControl={<RefreshControl refreshing={recs.isRefetching || own.isRefetching} onRefresh={() => { void recs.refetch(); void own.refetch(); void me.refetch(); }} tintColor={colors.emerald600} />}
        ListEmptyComponent={
          inReview ? undefined
          : recs.isLoading ? <View style={{ gap: space.md }}><Skeleton height={360} /><Skeleton height={20} width="60%" /></View>
          : recs.error ? <ErrorState message={errorMessage(recs.error)} onRetry={() => recs.refetch()} />
          : <EmptyState title="You’re all caught up" description="New matches arrive daily. Meanwhile, explore Discover or ask the Matchmaker." action={{ label: 'Discover', onPress: () => router.push('/discover') }} />
        }
        renderItem={({ item }) => (
          <View style={{ gap: 8 }}>
            {item.source === 'matchmaker' ? (
              <View style={{ backgroundColor: colors.gold50, borderColor: colors.gold200, borderWidth: 1, borderRadius: 14, padding: space.md, gap: 4 }}>
                <Text variant="eyebrow">Hand-picked by your matchmaker</Text>
                {item.reason && <Text>“{item.reason}”</Text>}
              </View>
            ) : item.reason ? <Text variant="small">{item.reason}</Text> : null}
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
          <Button title="Undo" size="sm" variant="gold" onPress={undoPass} />
        </View>
      )}
      {safety && <SafetySheet visible onClose={() => setSafety(null)} profileId={safety.profile.id} name={safety.profile.displayName} onBlocked={() => recs.refetch()} />}
    </View>
  );
}
