import * as React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { type } from '@/theme';

type Variant = keyof typeof type;

export function Text({ variant = 'body', style, ...props }: TextProps & { variant?: Variant }) {
  return <RNText maxFontSizeMultiplier={1.6} style={[type[variant], style]} {...props} />;
}
