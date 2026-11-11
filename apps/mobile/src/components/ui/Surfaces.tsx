import * as React from 'react';
import { ActivityIndicator, Animated, Image, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { useOnline } from '@/lib/network';
import { Text } from './Text';
import { Button } from './Button';

export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded && { padding: space.lg }, style]}>{children}</View>;
}

type Tone = 'neutral' | 'emerald' | 'gold' | 'success' | 'warning' | 'danger' | 'info';
const TONES: Record<Tone, [string, string]> = {
  neutral: [colors.surface2, colors.ink2], emerald: [colors.emerald50, colors.emerald700], gold: [colors.gold100, colors.gold600],
  success: [colors.successBg, colors.success], warning: [colors.warningBg, colors.warning], danger: [colors.dangerBg, colors.danger], info: [colors.infoBg, colors.info],
};
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const [bg, fg] = TONES[tone];
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={{ color: fg, fontFamily: fonts.medium, fontSize: 12 }}>{label}</Text></View>;
}

export function Avatar({ uri, name, size = 44, blurred }: { uri?: string | null; name: string; size?: number; blurred?: boolean }) {
  const initials = name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '·';
  const s = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !blurred) return <Image source={{ uri }} style={[s, { backgroundColor: colors.gold100 }]} accessibilityIgnoresInvertColors accessibilityLabel={`Photo of ${name}`} />;
  return (
    <View style={[s, styles.avatarFallback]} accessibilityLabel={blurred ? `${name}, photo shown after you connect` : name}>
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.4, color: colors.gold600 }}>{initials}</Text>
    </View>
  );
}

/** Safe-area screen with optional scroll + pull to refresh. */
export function Screen({ children, scroll = true, refreshing, onRefresh, edges = ['top'], style, contentStyle, scrollRef, ...rest }: {
  children: React.ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; edges?: Edge[]; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>;
  /** Ref to the inner ScrollView (e.g. to scroll to a section). */
  scrollRef?: React.Ref<ScrollViewInstance>;
} & Pick<ScrollViewProps, 'keyboardShouldPersistTaps'>) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      <OfflineBanner />
      {scroll ? (
        <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps={rest.keyboardShouldPersistTaps ?? 'handled'}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.emerald600} /> : undefined}>
          {children}
        </ScrollView>
      ) : <View style={[{ flex: 1 }, contentStyle]}>{children}</View>}
    </SafeAreaView>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <View style={styles.offline} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={{ color: colors.warning, fontSize: 13 }}>You’re offline — showing saved information.</Text>
    </View>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: { label: string; onPress: () => void }; icon?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      {icon && <View style={styles.emptyIcon}>{icon}</View>}
      <Text variant="title" style={{ textAlign: 'center' }}>{title}</Text>
      {description && <Text variant="bodyMuted" style={{ textAlign: 'center' }}>{description}</Text>}
      {action && <Button title={action.label} onPress={action.onPress} style={{ marginTop: space.md }} />}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={{ color: colors.danger, fontSize: 14 }}>{message}</Text>
      {onRetry && <Button title="Try again" variant="ghost" size="sm" onPress={onRetry} />}
    </View>
  );
}

export function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' | 'success' }) {
  const [bg, fg] = TONES[tone];
  return <View style={[styles.notice, { backgroundColor: bg }]}><Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{children}</Text></View>;
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const opacity = React.useRef(new Animated.Value(0.5)).current;
  React.useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ height, width, borderRadius: radius.md, backgroundColor: colors.surface2, opacity }, style]} />;
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <View style={styles.loading}><ActivityIndicator color={colors.emerald600} accessibilityLabel={label} /></View>;
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="heading" accessibilityRole="header">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: space.sm }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, gap: space.lg, paddingBottom: 48 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, ...shadow.soft },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  avatarFallback: { backgroundColor: colors.gold100, alignItems: 'center', justifyContent: 'center' },
  offline: { backgroundColor: colors.warningBg, paddingVertical: 6, paddingHorizontal: space.lg, alignItems: 'center' },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: 48, paddingHorizontal: space.xl, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, backgroundColor: colors.surface },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.gold100, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  error: { backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: space.md, gap: 4 },
  notice: { borderRadius: radius.md, padding: space.md },
  loading: { padding: space.xxl, alignItems: 'center' },
});
