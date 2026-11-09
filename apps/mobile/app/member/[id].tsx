import * as React from 'react';
import { Image, ScrollView, Share, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { MatchExplanation, ProfileDetail } from '@2k/shared';
import { api, ApiClientError, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { keys, useQuery } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Badge, Button, ErrorState, IconButton, Icon, Loading, Notice, Screen, Skeleton, Text } from '@/components/ui';
import { CompatibilityPanel } from '@/components/domain/CompatibilityPanel';
import { DetailSections } from '@/components/domain/DetailSections';
import { PrimaryAction, ShortlistButton } from '@/components/domain/ProfileActions';
import { SafetySheet } from '@/components/domain/SafetySheet';
import { VideoIntro } from '@/components/domain/VideoIntro';

export default function MemberProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useQuery({ queryKey: keys.member(id), queryFn: () => api.get<ProfileDetail>(`/profiles/${id}`) });
  const explanation = useQuery({
    queryKey: keys.explanation(id),
    queryFn: () => api.get<MatchExplanation>(`/profiles/${id}/explanation`),
    enabled: !!detail.data && !detail.data.isOwnProfile,
    retry: false,
  });
  const [safety, setSafety] = React.useState(false);
  const [feedback, setFeedback] = React.useState<-1 | 1 | null>(null);

  if (detail.isLoading) return <Screen edges={[]}><Skeleton height={380} /><Skeleton height={24} width="50%" /></Screen>;
  if (detail.error || !detail.data) {
    const gone = detail.error instanceof ApiClientError && detail.error.status === 404;
    return <Screen edges={[]}><ErrorState message={gone ? 'This profile is no longer available.' : errorMessage(detail.error)} onRetry={gone ? undefined : () => detail.refetch()} /></Screen>;
  }
  const d = detail.data;

  const sendFeedback = async (rating: -1 | 1) => {
    setFeedback(rating); haptic.tap();
    await api.post('/match-feedback', { candidateProfileId: d.id, rating, reason: rating === 1 ? 'great_fit' : 'not_my_preferences' }).catch(() => setFeedback(null));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{
        title: d.displayName,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton label="Share profile code" tone="subtle" size={36} onPress={() => Share.share({ message: `Profile ${d.profileCode} on 2K Marriage` })}><Icon name="share" size={18} /></IconButton>
            {!d.isOwnProfile && <IconButton label="Report or block" tone="subtle" size={36} onPress={() => setSafety(true)}><Icon name="flag" size={18} /></IconButton>}
          </View>
        ),
      }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 120 }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ borderRadius: 24 }} accessibilityLabel="Photos">
          {d.photos.length && !d.photos[0]?.blurred ? d.photos.map((p) => (
            <Image key={p.id} source={{ uri: p.url }} style={{ width: 340, height: 420, borderRadius: 24, marginRight: 8, backgroundColor: colors.gold50 }} accessibilityIgnoresInvertColors />
          )) : (
            <View style={{ width: 340, height: 300, borderRadius: 24, backgroundColor: colors.gold50, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
              <Text variant="hero" style={{ color: colors.gold600 }}>{d.displayName.slice(0, 1)}</Text>
              <Text variant="small" style={{ textAlign: 'center' }}>{d.photoBlurred ? 'Photos are shared once they accept your interest.' : 'No photos shared.'}</Text>
            </View>
          )}
        </ScrollView>
        <View style={{ gap: 6 }}>
          <Text variant="hero">{d.displayName}</Text>
          <Text variant="bodyMuted">{[d.age, d.city, d.profession].filter(Boolean).join(' · ')}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {d.verified.identity && <Badge label="ID verified" tone="success" />}
            {d.verified.photo && <Badge label="Photo verified" tone="info" />}
            {d.verified.phone && <Badge label="Phone verified" tone="neutral" />}
            {d.recentlyActive && <Badge label="Active this week" tone="gold" />}
          </View>
        </View>
        {d.video && <VideoIntro url={d.video.url} />}
        {!d.isOwnProfile && (
          explanation.isLoading ? <Loading label="Loading compatibility" />
          : explanation.data ? (
            <View style={{ gap: space.sm }}>
              <CompatibilityPanel explanation={explanation.data} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="small" style={{ flex: 1 }}>Was this suggestion helpful?</Text>
                <Button title="Yes" size="sm" variant={feedback === 1 ? 'primary' : 'secondary'} onPress={() => sendFeedback(1)} />
                <Button title="Not really" size="sm" variant={feedback === -1 ? 'primary' : 'secondary'} onPress={() => sendFeedback(-1)} />
              </View>
            </View>
          )
          : d.compatibility ? <Notice>{d.compatibility.label} · {d.compatibility.mutual}% mutual compatibility.</Notice> : null
        )}
        <DetailSections d={d} />
      </ScrollView>
      {!d.isOwnProfile && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 8, padding: space.lg, paddingBottom: space.xl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, alignItems: 'center' }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}><PrimaryAction card={d} /></View>
          <ShortlistButton card={d} />
        </View>
      )}
      <SafetySheet visible={safety} onClose={() => setSafety(false)} profileId={d.id} name={d.displayName} onBlocked={() => detail.refetch()} />
    </View>
  );
}
