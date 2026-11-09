import * as React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import type { ProfileCard } from '@2k/shared';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { Badge, Text } from '@/components/ui';

export function compatibilityTone(mutual: number) {
  return mutual >= 75 ? 'emerald' : mutual >= 60 ? 'gold' : 'neutral';
}

/** Member card (privacy-projected data from the API only). */
export function ProfileCardView({ card, actions, compact, linkable = true }: { card: ProfileCard; actions?: React.ReactNode; compact?: boolean; linkable?: boolean }) {
  const meta = [card.age ? `${card.age}` : null, card.city].filter(Boolean).join(' · ');
  const work = [card.profession, card.education].filter(Boolean).join(' · ');
  return (
    <View style={styles.card}>
      <Pressable
        onPress={linkable ? () => router.push(`/member/${card.id}` as Href) : undefined}
        disabled={!linkable}
        accessibilityRole={linkable ? 'button' : 'summary'}
        accessibilityLabel={`${card.displayName}, ${meta}${linkable ? '. View profile' : ''}`}
        android_ripple={{ color: colors.line }}
      >
        <View style={[styles.photoWrap, compact && { aspectRatio: 1.6 }]}>
          {card.photoUrl ? (
            <Image source={{ uri: card.photoUrl }} style={styles.photo} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.photo, styles.placeholder]}>
              <Text style={{ fontFamily: fonts.display, fontSize: 56, color: colors.gold600 }}>{card.displayName.slice(0, 1)}</Text>
              <Text variant="small">{card.photoBlurred ? 'Photo visible after they accept your interest' : 'No photo yet'}</Text>
            </View>
          )}
          {card.compatibility && (
            <View style={styles.compat}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.emerald700, fontSize: 13 }}>{card.compatibility.mutual}%</Text>
              <Text style={{ fontSize: 12, color: colors.ink2 }}>{card.compatibility.label}</Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text variant="title" style={{ fontSize: 26 }}>{card.displayName}</Text>
            {card.verified.identity && <Badge label="ID verified" tone="success" />}
            {card.verified.photo && <Badge label="Photo verified" tone="info" />}
          </View>
          {!!meta && <Text variant="bodyMuted">{meta}</Text>}
          {!!work && <Text variant="body" numberOfLines={1}>{work}</Text>}
          {!compact && !!card.intro && <Text variant="bodyMuted" numberOfLines={3}>{card.intro}</Text>}
          {card.sharedInterests.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {card.sharedInterests.slice(0, 4).map((i) => <Badge key={i} label={i} tone="gold" />)}
            </View>
          )}
        </View>
      </Pressable>
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadow.soft },
  photoWrap: { aspectRatio: 0.95, backgroundColor: colors.gold50 },
  photo: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.xl },
  compat: { position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(255,253,249,0.94)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', gap: 6, alignItems: 'center' },
  body: { padding: space.lg, gap: 6 },
  actions: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg, flexWrap: 'wrap' },
});
