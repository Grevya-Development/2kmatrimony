import * as React from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import type { OwnPhoto } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { pickImage, uploadAsset } from '@/lib/upload';
import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme';
import { Badge, Button, Icon, Text } from '@/components/ui';

/** Upload, reorder primary, delete. New photos are reviewed before others see them. */
export function PhotoManager({ photos, max, onChanged }: { photos: OwnPhoto[]; max: number; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);

  const add = (source: 'camera' | 'library') => async () => {
    const asset = await pickImage(source, { aspect: [4, 5] });
    if (!asset) return;
    setBusy(true);
    try {
      const up = await uploadAsset('photo', asset);
      await api.post('/profile/photos', { path: up.path, width: up.width, height: up.height });
      haptic.success();
      onChanged();
    } catch (e) { Alert.alert('Upload failed', errorMessage(e)); } finally { setBusy(false); }
  };

  const manage = (p: OwnPhoto) => {
    Alert.alert('Photo', undefined, [
      ...(p.isPrimary ? [] : [{ text: 'Make primary', onPress: async () => { try { await api.patch(`/profile/photos/${p.id}`, { isPrimary: true }); onChanged(); } catch (e) { Alert.alert('Error', errorMessage(e)); } } }]),
      { text: p.visibility === 'connections' ? 'Show to all members' : 'Only my connections', onPress: async () => { try { await api.patch(`/profile/photos/${p.id}`, { visibility: p.visibility === 'connections' ? 'inherit' : 'connections' }); onChanged(); } catch (e) { Alert.alert('Error', errorMessage(e)); } } },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.del(`/profile/photos/${p.id}`); onChanged(); } catch (e) { Alert.alert('Error', errorMessage(e)); } } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {photos.map((p) => (
          <Pressable key={p.id} onPress={() => manage(p)} accessibilityRole="button" accessibilityLabel={`Photo${p.isPrimary ? ', primary' : ''}, ${p.moderationStatus}. Manage`} style={{ width: '31%', aspectRatio: 0.8 }}>
            {p.url ? <Image source={{ uri: p.url }} style={{ width: '100%', height: '100%', borderRadius: radius.md }} /> : <View style={{ flex: 1, borderRadius: radius.md, backgroundColor: colors.surface2 }} />}
            <View style={{ position: 'absolute', left: 4, top: 4, gap: 2 }}>
              {p.isPrimary && <Badge label="Primary" tone="burgundy" />}
              {p.moderationStatus !== 'approved' && <Badge label={p.moderationStatus === 'pending' ? 'In review' : 'Rejected'} tone={p.moderationStatus === 'pending' ? 'warning' : 'danger'} />}
            </View>
          </Pressable>
        ))}
        {photos.length < max && (
          <Pressable onPress={add('library')} disabled={busy} accessibilityRole="button" accessibilityLabel="Add a photo from your library" style={{ width: '31%', aspectRatio: 0.8, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
            <Icon name="image" color={colors.muted} />
            <Text variant="small">{busy ? 'Uploading…' : 'Add'}</Text>
          </Pressable>
        )}
      </View>
      {photos.length < max && <Button title="Take a photo" variant="secondary" size="sm" icon={<Icon name="camera" size={16} />} onPress={add('camera')} loading={busy} />}
      <Text variant="small">Up to {max} photos. Clear, recent photos of your face work best. Photos are reviewed before other members see them.</Text>
    </View>
  );
}
