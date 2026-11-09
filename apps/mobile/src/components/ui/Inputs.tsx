import * as React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius } from '@/theme';
import { Text } from './Text';

export interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  prefix?: string;
}

export function TextField({ label, hint, error, optional, prefix, style, multiline, ...props }: TextFieldProps) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="label">{label}</Text>
        {optional && <Text variant="small">Optional</Text>}
      </View>
      <View style={[styles.box, multiline && styles.multi, focused && styles.focused, !!error && styles.errorBox]}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={`${colors.muted}AA`}
          style={[styles.input, multiline && { textAlignVertical: 'top', paddingTop: 12 }, style]}
          multiline={multiline}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          maxFontSizeMultiplier={1.5}
          {...props}
        />
      </View>
      {error ? <Text variant="small" style={{ color: colors.danger }} accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text variant="small">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  box: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14 },
  multi: { minHeight: 110, alignItems: 'flex-start' },
  focused: { borderColor: colors.burgundy500 },
  errorBox: { borderColor: colors.danger },
  prefix: { color: colors.ink2, marginRight: 8, fontFamily: fonts.medium },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: 10 },
});
