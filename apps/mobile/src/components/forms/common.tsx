import * as React from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { space } from '@/theme';
import { Button, ErrorState, Text } from '@/components/ui';

export interface FormProps<T> {
  initial: Partial<T>;
  onSubmit: (values: T) => Promise<unknown>;
  submitLabel?: string;
  onSkip?: () => void;
  /** "you" vs "they" copy when a profile is created for someone else. */
  forSelf?: boolean;
}

export function Q({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label">{label}</Text>
      {help && <Text variant="small">{help}</Text>}
      {children}
    </View>
  );
}

/** Submit/skip footer with inline error handling. */
export function useSubmit<T>(onSubmit: (v: T) => Promise<unknown>) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async (v: T, validate?: () => string | null) => {
    const problem = validate?.() ?? null;
    if (problem) { setError(problem); haptic.warning(); return; }
    setBusy(true); setError(null);
    try { await onSubmit(v); haptic.success(); } catch (e) { setError(errorMessage(e)); haptic.warning(); } finally { setBusy(false); }
  };
  return { busy, error, submit };
}

export function Footer({ busy, error, onPress, label = 'Save & continue', onSkip }: { busy: boolean; error: string | null; onPress: () => void; label?: string; onSkip?: () => void }) {
  return (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      {error && <ErrorState message={error} />}
      <Button title={label} size="lg" onPress={onPress} loading={busy} full />
      {onSkip && <Button title="Skip for now" variant="ghost" onPress={onSkip} />}
    </View>
  );
}

export const toNum = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s));
export const first = <T,>(v: T[]): T | null => v[0] ?? null;
export const arr = <T,>(v: T | null | undefined): T[] => (v === null || v === undefined ? [] : [v]);
