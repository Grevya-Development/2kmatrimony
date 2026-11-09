import * as React from 'react';
import { View } from 'react-native';
import {
  DIET_OPTIONS, FAMILY_STRUCTURE_OPTIONS, FAMILY_VALUES_OPTIONS, FITNESS_OPTIONS, HABIT_OPTIONS, INTEREST_SUGGESTIONS, TRAVEL_OPTIONS,
  type FamilyInput, type LifestyleInput,
} from '@2k/shared';
import { space } from '@/theme';
import { Chip, ChipGroup, TextField } from '@/components/ui';
import { Footer, Q, arr, first, toNum, useSubmit, type FormProps } from './common';

export function FamilyForm({ initial, onSubmit, submitLabel, onSkip }: FormProps<FamilyInput>) {
  const [v, setV] = React.useState<FamilyInput>({
    familyStructure: initial.familyStructure ?? null, familyValues: initial.familyValues ?? null, familyBackground: initial.familyBackground ?? null,
    fatherOccupation: initial.fatherOccupation ?? null, motherOccupation: initial.motherOccupation ?? null, brothers: initial.brothers ?? null,
    sisters: initial.sisters ?? null, siblingsDetails: initial.siblingsDetails ?? null, familyNativePlace: initial.familyNativePlace ?? null, familyLocation: initial.familyLocation ?? null,
  });
  const set = <K extends keyof FamilyInput>(k: K, val: FamilyInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const { busy, error, submit } = useSubmit(onSubmit);
  return (
    <View style={{ gap: space.lg }}>
      <Q label="Family type"><ChipGroup label="Family type" options={FAMILY_STRUCTURE_OPTIONS} value={arr(v.familyStructure)} onChange={(x) => set('familyStructure', first(x))} /></Q>
      <Q label="Family values"><ChipGroup label="Family values" options={FAMILY_VALUES_OPTIONS} value={arr(v.familyValues)} onChange={(x) => set('familyValues', first(x))} /></Q>
      <TextField label="Father’s occupation" optional value={v.fatherOccupation ?? ''} onChangeText={(t) => set('fatherOccupation', t || null)} />
      <TextField label="Mother’s occupation" optional value={v.motherOccupation ?? ''} onChangeText={(t) => set('motherOccupation', t || null)} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><TextField label="Brothers" optional keyboardType="number-pad" maxLength={2} value={v.brothers?.toString() ?? ''} onChangeText={(t) => set('brothers', toNum(t))} /></View>
        <View style={{ flex: 1 }}><TextField label="Sisters" optional keyboardType="number-pad" maxLength={2} value={v.sisters?.toString() ?? ''} onChangeText={(t) => set('sisters', toNum(t))} /></View>
      </View>
      <TextField label="Family location" optional value={v.familyLocation ?? ''} onChangeText={(t) => set('familyLocation', t || null)} />
      <TextField label="About the family" optional multiline maxLength={1000} value={v.familyBackground ?? ''} onChangeText={(t) => set('familyBackground', t || null)} />
      <Footer busy={busy} error={error} label={submitLabel} onSkip={onSkip} onPress={() => submit(v)} />
    </View>
  );
}

export function LifestyleForm({ initial, onSubmit, submitLabel, onSkip }: FormProps<LifestyleInput>) {
  const [v, setV] = React.useState<LifestyleInput>({
    diet: initial.diet ?? null, smoking: initial.smoking ?? null, drinking: initial.drinking ?? null, fitness: initial.fitness ?? null,
    travel: initial.travel ?? null, hobbies: initial.hobbies ?? [], interests: initial.interests ?? [],
  });
  const [draft, setDraft] = React.useState('');
  const set = <K extends keyof LifestyleInput>(k: K, val: LifestyleInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const toggle = (i: string) => set('interests', v.interests.includes(i) ? v.interests.filter((x) => x !== i) : v.interests.length < 20 ? [...v.interests, i] : v.interests);
  const { busy, error, submit } = useSubmit(onSubmit);
  return (
    <View style={{ gap: space.lg }}>
      <Q label="Diet"><ChipGroup label="Diet" options={DIET_OPTIONS} value={arr(v.diet)} onChange={(x) => set('diet', first(x))} /></Q>
      <Q label="Smoking"><ChipGroup label="Smoking" options={HABIT_OPTIONS} value={arr(v.smoking)} onChange={(x) => set('smoking', first(x))} /></Q>
      <Q label="Drinking"><ChipGroup label="Drinking" options={HABIT_OPTIONS} value={arr(v.drinking)} onChange={(x) => set('drinking', first(x))} /></Q>
      <Q label="Fitness"><ChipGroup label="Fitness" options={FITNESS_OPTIONS} value={arr(v.fitness)} onChange={(x) => set('fitness', first(x))} /></Q>
      <Q label="Travel"><ChipGroup label="Travel" options={TRAVEL_OPTIONS} value={arr(v.travel)} onChange={(x) => set('travel', first(x))} /></Q>
      <Q label="Interests" help="Pick a few, or add your own.">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[...new Set([...INTEREST_SUGGESTIONS, ...v.interests])].map((i) => <Chip key={i} label={i} selected={v.interests.includes(i)} onPress={() => toggle(i)} />)}
        </View>
        <TextField label="Add an interest" value={draft} onChangeText={setDraft} returnKeyType="done" onSubmitEditing={() => { if (draft.trim()) { toggle(draft.trim()); setDraft(''); } }} />
      </Q>
      <Footer busy={busy} error={error} label={submitLabel} onSkip={onSkip} onPress={() => submit(v)} />
    </View>
  );
}
