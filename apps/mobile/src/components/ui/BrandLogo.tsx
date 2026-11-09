import { Image } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

/**
 * 2K Marriage logo — supplied Brand DNA artwork (never retyped).
 * horizontal: rings | wordmark · stacked: with "Tradition Meets AI" · mark: rings only.
 */
const ART = {
  horizontal: { source: require('../../../assets/brand/logo-horizontal.png'), ratio: 479 / 114 },
  stacked: { source: require('../../../assets/brand/logo-stacked.png'), ratio: 1351.5 / 699.5 },
  mark: { source: require('../../../assets/brand/mark-gold.png'), ratio: 492 / 376 },
} as const;

export function BrandLogo({ variant = 'horizontal', height = 36, style }: { variant?: keyof typeof ART; height?: number; style?: StyleProp<ImageStyle> }) {
  const a = ART[variant];
  return <Image source={a.source} style={[{ height, width: height * a.ratio }, style]} contentFit="contain" accessibilityLabel="2K Marriage" accessibilityRole="image" />;
}
