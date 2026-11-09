import { BrandLogo } from '@/components/ui/BrandLogo';
import * as React from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { authenticate, isBiometricEnabled, LOCK_AFTER_MS } from '@/lib/biometric';
import { colors, space } from '@/theme';
import { Button, Text } from '@/components/ui';

/** Biometric lock overlay: cold start, and on resume after 5+ minutes in background. */
export function BiometricGate({ children, active }: { children: React.ReactNode; active: boolean }) {
  const [locked, setLocked] = React.useState(false);
  const [checked, setChecked] = React.useState(false);
  const backgroundAt = React.useRef<number | null>(null);

  const unlock = React.useCallback(async () => {
    if (await authenticate()) setLocked(false);
  }, []);

  React.useEffect(() => {
    if (!active) { setLocked(false); setChecked(true); return; }
    isBiometricEnabled().then((on) => { setLocked(on); setChecked(true); if (on) void unlock(); });
    const sub = AppState.addEventListener('change', async (s) => {
      if (s === 'background') backgroundAt.current = Date.now();
      if (s === 'active' && backgroundAt.current && Date.now() - backgroundAt.current > LOCK_AFTER_MS && (await isBiometricEnabled())) {
        setLocked(true);
        void unlock();
      }
    });
    return () => sub.remove();
  }, [active, unlock]);

  if (!checked) return null;
  return (
    <>
      {children}
      {locked && (
        <View style={[StyleSheet.absoluteFill, styles.lock]} accessibilityViewIsModal>
          <BrandLogo variant="mark" height={56} />
          <Text variant="title">2K Matrimony is locked</Text>
          <Text variant="bodyMuted" style={{ textAlign: 'center' }}>Use Face ID, Touch ID or your fingerprint to continue.</Text>
          <Button title="Unlock" onPress={unlock} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  lock: { backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl, zIndex: 100 },
});
