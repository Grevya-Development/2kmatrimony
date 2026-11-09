import * as React from 'react';
import { Alert, View } from 'react-native';
import { AUDIENCE_OPTIONS, type Audience, type OwnProfileResponse } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { pickVideo, uploadAsset } from '@/lib/upload';
import { checkVideoLength } from '@/lib/video';
import { haptic } from '@/lib/haptics';
import { space } from '@/theme';
import { Badge, Button, ChipGroup, Text } from '@/components/ui';
import { VideoIntro } from './VideoIntro';

/** Optional 15–60s introduction video: record or pick, upload, set visibility, delete. */
export function VideoManager({ video, limits, onChanged }: { video: OwnProfileResponse['video']; limits: OwnProfileResponse['limits']; onChanged: () => void }) {
  const [visibility, setVisibility] = React.useState<Audience[]>([video?.visibility ?? 'members']);
  const [busy, setBusy] = React.useState(false);

  const add = (source: 'camera' | 'library') => async () => {
    const asset = await pickVideo(source, limits.videoMaxSeconds);
    if (!asset) return;
    const check = checkVideoLength(asset.duration, limits.videoMinSeconds, limits.videoMaxSeconds);
    if (!check.ok) return Alert.alert('Video length', check.message);
    const secs = check.seconds;
    setBusy(true);
    try {
      const up = await uploadAsset('video', asset);
      await api.post('/profile/video', { path: up.path, durationSeconds: secs, visibility: visibility[0] ?? 'members' });
      haptic.success();
      Alert.alert('Video uploaded', 'It will be visible to others after a quick review.');
      onChanged();
    } catch (e) { Alert.alert('Upload failed', errorMessage(e)); } finally { setBusy(false); }
  };

  const remove = () => Alert.alert('Remove your video?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => { try { await api.del('/profile/video'); onChanged(); } catch (e) { Alert.alert('Error', errorMessage(e)); } } },
  ]);

  return (
    <View style={{ gap: space.md }}>
      <Text variant="bodyMuted">Optional. A {limits.videoMinSeconds}–{limits.videoMaxSeconds} second hello in your own words. Never required.</Text>
      {video ? (
        <>
          {video.url ? <VideoIntro url={video.url} /> : null}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Badge label={`${video.durationSeconds}s`} />
            <Badge label={video.moderationStatus === 'approved' ? 'Approved' : video.moderationStatus === 'pending' ? 'In review' : 'Rejected'} tone={video.moderationStatus === 'approved' ? 'success' : video.moderationStatus === 'pending' ? 'warning' : 'danger'} />
            <Badge label={`Visible to: ${video.visibility}`} tone="neutral" />
          </View>
          <Button title="Remove video" variant="ghost" size="sm" onPress={remove} />
        </>
      ) : (
        <>
          <Text variant="label">Who can watch it</Text>
          <ChipGroup label="Video visibility" options={AUDIENCE_OPTIONS} value={visibility} onChange={setVisibility} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Record" size="sm" onPress={add('camera')} loading={busy} />
            <Button title="Choose video" size="sm" variant="secondary" onPress={add('library')} disabled={busy} />
          </View>
          {busy && <Text variant="small">Uploading — this can take a moment on mobile data.</Text>}
        </>
      )}
    </View>
  );
}
