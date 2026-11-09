import * as React from 'react';
import { View } from 'react-native';
import {
  CHILDREN_OPTIONS, DIET_OPTIONS, EDUCATION_LEVEL_OPTIONS, FAMILY_VALUES_OPTIONS, MARITAL_STATUS_OPTIONS, SETTLE_OPTIONS,
  type SearchFilters,
} from '@2k/shared';
import { serializeFilters } from '@/lib/filters';
import { Badge, Button, Chip, ChipGroup, Divider, Text, TextField } from '@/components/ui';
import { Sheet } from '@/components/ui/Controls';
import { space } from '@/theme';

const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? undefined : Number(s));

export function FilterSheet({ visible, onClose, initial, onApply, advancedAllowed }: {
  visible: boolean; onClose: () => void; initial: SearchFilters; onApply: (f: SearchFilters) => void; advancedAllowed: boolean;
}) {
  const [f, setF] = React.useState<SearchFilters>(initial);
  React.useEffect(() => { if (visible) setF(initial); }, [visible, initial]);
  const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => setF((p) => ({ ...p, [k]: v }));
  const [cityDraft, setCityDraft] = React.useState('');

  return (
    <Sheet visible={visible} onClose={onClose} title="Filters"
      footer={<View style={{ flexDirection: 'row', gap: space.sm, paddingTop: space.sm }}>
        <Button title="Clear" variant="secondary" onPress={() => setF({})} style={{ flex: 1 }} />
        <Button title="Show results" onPress={() => { onApply(serializeFilters(f)); onClose(); }} style={{ flex: 2 }} />
      </View>}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}><TextField label="Min age" keyboardType="number-pad" value={f.ageMin?.toString() ?? ''} onChangeText={(t) => set('ageMin', num(t))} /></View>
        <View style={{ flex: 1 }}><TextField label="Max age" keyboardType="number-pad" value={f.ageMax?.toString() ?? ''} onChangeText={(t) => set('ageMax', num(t))} /></View>
      </View>
      <View style={{ gap: 8 }}>
        <TextField label="Cities" value={cityDraft} onChangeText={setCityDraft} placeholder="Type a city and tap Add" onSubmitEditing={() => { if (cityDraft.trim()) { set('cities', [...(f.cities ?? []), cityDraft.trim()]); setCityDraft(''); } }} returnKeyType="done" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(f.cities ?? []).map((c) => <Chip key={c} label={c} onRemove={() => set('cities', (f.cities ?? []).filter((x) => x !== c))} />)}
        </View>
      </View>
      <Text variant="label">Marital status</Text>
      <ChipGroup label="Marital status" multiple options={MARITAL_STATUS_OPTIONS} value={f.maritalStatuses ?? []} onChange={(v) => set('maritalStatuses', v)} />
      <Text variant="label">Education</Text>
      <ChipGroup label="Education" multiple options={EDUCATION_LEVEL_OPTIONS} value={f.educationLevels ?? []} onChange={(v) => set('educationLevels', v)} />
      <Text variant="label">Diet</Text>
      <ChipGroup label="Diet" multiple options={DIET_OPTIONS} value={f.diets ?? []} onChange={(v) => set('diets', v)} />
      <Chip label="With photo only" selected={!!f.withPhotoOnly} onPress={() => set('withPhotoOnly', !f.withPhotoOnly)} />
      <Divider />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant="heading">Advanced</Text>
        {!advancedAllowed && <Badge label="Plus & above" tone="champagne" />}
      </View>
      <View pointerEvents={advancedAllowed ? 'auto' : 'none'} style={{ gap: space.md, opacity: advancedAllowed ? 1 : 0.45 }} accessibilityState={{ disabled: !advancedAllowed }}>
        <Chip label="Verified profiles only" selected={!!f.verifiedOnly} onPress={() => set('verifiedOnly', !f.verifiedOnly)} />
        <Text variant="label">Family values</Text>
        <ChipGroup label="Family values" multiple options={FAMILY_VALUES_OPTIONS} value={f.familyValues ?? []} onChange={(v) => set('familyValues', v)} />
        <Text variant="label">Children</Text>
        <ChipGroup label="Children" multiple options={CHILDREN_OPTIONS} value={f.childrenPreferences ?? []} onChange={(v) => set('childrenPreferences', v)} />
        <Text variant="label">Where they want to settle</Text>
        <ChipGroup label="Settle preference" multiple options={SETTLE_OPTIONS} value={f.settlePreferences ?? []} onChange={(v) => set('settlePreferences', v)} />
        <TextField label="Keywords" value={f.text ?? ''} onChangeText={(t) => set('text', t || undefined)} placeholder="e.g. hiking, startups" />
      </View>
    </Sheet>
  );
}
