import * as React from 'react';
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { haptic } from '@/lib/haptics';
import { Text } from './Text';

export function SegmentedControl<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.seg}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => { haptic.tap(); onChange(o.value); }} style={[styles.segItem, active && styles.segActive]}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: active ? colors.canvas : colors.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Accessible spectrum slider (0–100). Drag or tap; screen readers use
 * increment/decrement actions in steps of 10.
 */
export function SpectrumSlider({ value, onChange, left, right, label, disabled }: { value: number; onChange: (v: number) => void; left: string; right: string; label: string; disabled?: boolean }) {
  const [width, setWidth] = React.useState(1);
  const widthRef = React.useRef(1);
  const startRef = React.useRef(value);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const responder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const v = clamp((e.nativeEvent.locationX / widthRef.current) * 100);
      startRef.current = v;
      onChange(v);
    },
    onPanResponderMove: (_e, g) => onChange(clamp(startRef.current + (g.dx / widthRef.current) * 100)),
    onPanResponderRelease: () => haptic.tap(),
  }), [disabled, onChange]);

  const onLayout = (e: LayoutChangeEvent) => { widthRef.current = e.nativeEvent.layout.width || 1; setWidth(widthRef.current); };
  const x = (value / 100) * width;
  return (
    <View style={{ gap: 6 }}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: value, text: `${value} — closer to ${value < 50 ? left : right}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(clamp(valueRef.current + (e.nativeEvent.actionName === 'increment' ? 10 : -10)))}
        onLayout={onLayout}
        style={styles.track}
        {...responder.panHandlers}
      >
        <View style={styles.rail} />
        <View style={[styles.fill, { width: x }]} />
        <View style={[styles.thumb, { left: x - 12 }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
        <Text variant="small" style={{ flex: 1 }}>{left}</Text>
        <Text variant="small" style={{ flex: 1, textAlign: 'right' }}>{right}</Text>
      </View>
    </View>
  );
}

/** Simple stepper for 1–5 importance. */
export function ImportancePicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: n === value }} accessibilityLabel={`Importance ${n} of 5`}
          onPress={() => { haptic.tap(); onChange(n); }} style={[styles.dot, n <= value && { backgroundColor: colors.burgundy500, borderColor: colors.burgundy500 }]} />
      ))}
    </View>
  );
}

/** Bottom sheet built on Modal (no extra native deps). */
export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} accessibilityViewIsModal>
        <View style={styles.grabber} />
        <View style={styles.sheetHeader}>
          <Text variant="title" accessibilityRole="header">{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}><Text variant="label">Close</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: space.lg, paddingBottom: space.lg }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        {footer}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, padding: 4 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill },
  segActive: { backgroundColor: colors.ink },
  track: { height: 36, justifyContent: 'center' },
  rail: { height: 6, borderRadius: 3, backgroundColor: colors.line },
  fill: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: colors.burgundy500 },
  thumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.burgundy600, backgroundColor: colors.white },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.lineStrong },
  backdrop: { flex: 1, backgroundColor: 'rgba(31,29,27,0.35)' },
  sheet: { maxHeight: '88%', backgroundColor: colors.canvas, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.lg },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md },
});
