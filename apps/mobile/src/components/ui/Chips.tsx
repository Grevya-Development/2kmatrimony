import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Option } from '@2k/shared';
import { colors, fonts, radius } from '@/theme';
import { haptic } from '@/lib/haptics';
import { Text } from './Text';

export function Chip({ label, selected, onPress, onRemove, accessibilityRole }: { label: string; selected?: boolean; onPress?: () => void; onRemove?: () => void; accessibilityRole?: 'checkbox' | 'radio' | 'button' }) {
  return (
    <Pressable
      onPress={onPress ?? onRemove}
      accessibilityRole={accessibilityRole ?? (onRemove ? 'button' : 'checkbox')}
      accessibilityState={onRemove ? undefined : { checked: !!selected }}
      accessibilityLabel={onRemove ? `Remove ${label}` : label}
      android_ripple={{ color: colors.line }}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.text, selected && { color: colors.white }]}>{label}{onRemove ? '  ×' : ''}</Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({ options, value, onChange, multiple, max, label }: { options: Option<T>[]; value: T[]; onChange: (v: T[]) => void; multiple?: boolean; max?: number; label: string }) {
  return (
    <View accessibilityRole={multiple ? undefined : 'radiogroup'} accessibilityLabel={label} style={styles.group}>
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <Chip
            key={o.value}
            label={o.label}
            selected={active}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            onPress={() => {
              haptic.tap();
              if (!multiple) return onChange([o.value]);
              if (active) return onChange(value.filter((v) => v !== o.value));
              if (max && value.length >= max) return;
              onChange([...value, o.value]);
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' },
  selected: { backgroundColor: colors.burgundy600, borderColor: colors.burgundy600 },
  text: { fontFamily: fonts.body, fontSize: 14, color: colors.ink2 },
});
