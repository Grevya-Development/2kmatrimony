import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'champagne' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const BG: Record<Variant, string> = { primary: colors.burgundy600, secondary: colors.surface, ghost: 'transparent', champagne: colors.champagne100, danger: colors.danger };
const FG: Record<Variant, string> = { primary: colors.white, secondary: colors.ink, ghost: colors.ink2, champagne: colors.ink, danger: colors.white };
const H: Record<Size, number> = { sm: 36, md: 46, lg: 54 };

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}

export function Button({ title, variant = 'primary', size = 'md', loading, disabled, icon, style, full, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      android_ripple={{ color: variant === 'primary' ? colors.burgundy700 : colors.line }}
      style={({ pressed }) => [
        styles.base,
        { height: H[size], backgroundColor: BG[variant], paddingHorizontal: size === 'sm' ? 14 : 20 },
        variant === 'secondary' && styles.outlined,
        full && styles.full,
        pressed && Platform.OS === 'ios' && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
      {...props}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={FG[variant]} size="small" /> : icon}
        <Text style={{ color: FG[variant], fontFamily: fonts.medium, fontSize: size === 'sm' ? 14 : 15 }} numberOfLines={1}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  outlined: { borderWidth: 1, borderColor: colors.lineStrong },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

/** Icon-only round button (requires an accessibility label). */
export function IconButton({ label, children, onPress, tone = 'default', size = 44, disabled }: { label: string; children: React.ReactNode; onPress?: () => void; tone?: 'default' | 'primary' | 'subtle'; size?: number; disabled?: boolean }) {
  const bg = tone === 'primary' ? colors.burgundy600 : tone === 'subtle' ? colors.surface2 : colors.surface;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} hitSlop={6}
      android_ripple={{ color: colors.line, borderless: true }}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: tone === 'default' ? 1 : 0, borderColor: colors.line, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}>
      {children}
    </Pressable>
  );
}
