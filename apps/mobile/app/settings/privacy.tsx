import * as React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AUDIENCE_OPTIONS, NAME_VISIBILITY, PHOTO_VISIBILITY_OPTIONS, type PrivacyInput } from '@2k/shared';
import { api } from '@/lib/api';
import { keys, useOwnProfile, useQueryClient } from '@/hooks/queries';
import { space } from '@/theme';
import { ChipGroup, Loading, Screen, Text } from '@/components/ui';
import { Footer, Q, useSubmit } from '@/components/forms/common';

const NAME_OPTS = NAME_VISIBILITY.map((v) => ({ value: v, label: v === 'full' ? 'Full name' : v === 'first_name' ? 'First name + initial' : 'Initials' }));

export default function Privacy() {
  const qc = useQueryClient();
  const profile = useOwnProfile();
  const [v, setV] = React.useState<PrivacyInput | null>(null);
  React.useEffect(() => { if (profile.data && !v) setV(profile.data.form.privacy); }, [profile.data, v]);
  const { busy, error, submit } = useSubmit(async (x: PrivacyInput) => {
    await api.put('/profile/privacy', x);
    await qc.invalidateQueries({ queryKey: keys.profile });
    router.back();
  });
  if (!v) return <Screen edges={[]}><Loading /></Screen>;
  const set = <K extends keyof PrivacyInput>(k: K, val: PrivacyInput[K]) => setV((p) => (p ? { ...p, [k]: val } : p));
  return (
    <Screen edges={[]}>
      <Text variant="bodyMuted">Profiles are only ever visible to signed-in members. Identity documents are never shown to anyone.</Text>
      <View style={{ gap: space.lg }}>
        <Q label="Who can find my profile"><ChipGroup label="Profile visibility" options={AUDIENCE_OPTIONS} value={[v.visibility]} onChange={(x) => set('visibility', x[0] ?? v.visibility)} /></Q>
        <Q label="Who can see my photos"><ChipGroup label="Photo visibility" options={PHOTO_VISIBILITY_OPTIONS} value={[v.photoVisibility]} onChange={(x) => set('photoVisibility', x[0] ?? v.photoVisibility)} /></Q>
        <Q label="Religion, community & family details" help="Sensitive details"><ChipGroup label="Sensitive details visibility" options={AUDIENCE_OPTIONS} value={[v.sensitiveFieldsVisibility]} onChange={(x) => set('sensitiveFieldsVisibility', x[0] ?? v.sensitiveFieldsVisibility)} /></Q>
        <Q label="Show my name as"><ChipGroup label="Name visibility" options={NAME_OPTS} value={[v.nameVisibility]} onChange={(x) => set('nameVisibility', x[0] ?? v.nameVisibility)} /></Q>
        <Q label="Who can message me"><ChipGroup label="Messaging" options={[{ value: 'connections', label: 'My connections' }, { value: 'connections_verified', label: 'Only verified connections' }]} value={[v.messagingPolicy]} onChange={(x) => set('messagingPolicy', (x[0] ?? v.messagingPolicy) as PrivacyInput['messagingPolicy'])} /></Q>
        <Footer busy={busy} error={error} label="Save" onPress={() => submit(v)} />
      </View>
    </Screen>
  );
}
