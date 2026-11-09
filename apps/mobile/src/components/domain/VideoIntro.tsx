import * as React from 'react';
import { View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, radius } from '@/theme';

/** Member's optional introduction video (signed URL from the API). */
export function VideoIntro({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => { p.loop = false; });
  return (
    <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.ink, aspectRatio: 9 / 12 }}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls contentFit="cover" accessibilityLabel="Introduction video" />
    </View>
  );
}
