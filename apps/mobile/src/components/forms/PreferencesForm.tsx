import * as React from 'react';
import { View } from 'react-native';
import {
  CHILDREN_OPTIONS, CORE_VALUES, DIET_OPTIONS, EDUCATION_LEVEL_OPTIONS, FAMILY_VALUES_OPTIONS, GENDER_OPTIONS, HABIT_OPTIONS,
  LIVING_OPTIONS, MARITAL_STATUS_OPTIONS, NON_NEGOTIABLE_FIELDS, NON_NEGOTIABLE_LABELS, type PartnerPreferencesInput,
} from '@2k/shared';
import { space } from '@/theme';
import { Chip, ChipGroup, Notice, TextField } from '@/components/ui';
import { Footer, Q, toNum, useSubmit, type FormProps } from './common';

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const NN = NON_NEGOTIABLE_FIELDS.map((f) => ({ value: f, label: NON_NEGOTIABLE_LABELS[f] }));
const VALUES = CORE_VALUES.map((v) => ({ value: v, label: label(v) }));

export function PreferencesForm({ initial, onSubmit, submitLabel, forSelf = true }: FormProps<PartnerPreferencesInput>) {
  const [v, setV] = React.useState({
    seekingGenders: initial.seekingGenders ?? [], ageMin: initial.ageMin?.toString() ?? '24', ageMax: initial.ageMax?.toString() ?? '34',
    heightMinCm: initial.heightMinCm?.toString() ?? '', heightMaxCm: initial.heightMaxCm?.toString() ?? '',
    maritalStatuses: initial.maritalStatuses ?? [], educationLevels: initial.educationLevels ?? [], cities: initial.cities ?? [],
    diets: initial.diets ?? [], smokingOk: initial.smokingOk ?? [], drinkingOk: initial.drinkingOk ?? [], familyValues: initial.familyValues ?? [],
    childrenPreferences: initial.childrenPreferences ?? [], livingArrangements: initial.livingArrangements ?? [], coreValues: initial.coreValues ?? [],
    nonNegotiables: initial.nonNegotiables ?? [], freeText: initial.freeText ?? '',
  });
  const [city, setCity] = React.useState('');
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const { busy, error, submit } = useSubmit(onSubmit);

  const go = () => submit({
    ...initial,
    seekingGenders: v.seekingGenders, ageMin: toNum(v.ageMin) ?? 18, ageMax: toNum(v.ageMax) ?? 99, heightMinCm: toNum(v.heightMinCm), heightMaxCm: toNum(v.heightMaxCm),
    maritalStatuses: v.maritalStatuses, educationLevels: v.educationLevels, cities: v.cities, diets: v.diets, smokingOk: v.smokingOk, drinkingOk: v.drinkingOk,
    familyValues: v.familyValues, childrenPreferences: v.childrenPreferences, livingArrangements: v.livingArrangements, coreValues: v.coreValues,
    nonNegotiables: v.nonNegotiables, freeText: v.freeText.trim() || null,
    professions: initial.professions ?? [], countries: initial.countries ?? [], personalityTraits: initial.personalityTraits ?? [], motherTongues: initial.motherTongues ?? [], religions: initial.religions ?? [],
  } as PartnerPreferencesInput, () => {
    if (!v.seekingGenders.length) return 'Choose who you’d like to meet.';
    const a = toNum(v.ageMin), b = toNum(v.ageMax);
    if (a === null || b === null || a < 18 || b > 99 || a > b) return 'Enter a valid age range (18–99).';
    return null;
  });

  return (
    <View style={{ gap: space.lg }}>
      <Q label={forSelf ? 'You’d like to meet' : 'They’d like to meet'}><ChipGroup label="Seeking" multiple options={GENDER_OPTIONS} value={v.seekingGenders} onChange={(x) => set('seekingGenders', x)} /></Q>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><TextField label="Age from" keyboardType="number-pad" maxLength={2} value={v.ageMin} onChangeText={(t) => set('ageMin', t)} /></View>
        <View style={{ flex: 1 }}><TextField label="Age to" keyboardType="number-pad" maxLength={2} value={v.ageMax} onChangeText={(t) => set('ageMax', t)} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><TextField label="Height from (cm)" optional keyboardType="number-pad" maxLength={3} value={v.heightMinCm} onChangeText={(t) => set('heightMinCm', t)} /></View>
        <View style={{ flex: 1 }}><TextField label="Height to (cm)" optional keyboardType="number-pad" maxLength={3} value={v.heightMaxCm} onChangeText={(t) => set('heightMaxCm', t)} /></View>
      </View>
      <Q label="Marital status"><ChipGroup label="Marital status" multiple options={MARITAL_STATUS_OPTIONS} value={v.maritalStatuses} onChange={(x) => set('maritalStatuses', x)} /></Q>
      <Q label="Education (at least)"><ChipGroup label="Education" multiple options={EDUCATION_LEVEL_OPTIONS} value={v.educationLevels} onChange={(x) => set('educationLevels', x)} /></Q>
      <Q label="Preferred cities" help="Leave empty for anywhere.">
        <TextField label="Add a city" value={city} onChangeText={setCity} returnKeyType="done" onSubmitEditing={() => { if (city.trim()) { set('cities', [...v.cities, city.trim()]); setCity(''); } }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{v.cities.map((c) => <Chip key={c} label={c} onRemove={() => set('cities', v.cities.filter((x) => x !== c))} />)}</View>
      </Q>
      <Q label="Diet"><ChipGroup label="Diet" multiple options={DIET_OPTIONS} value={v.diets} onChange={(x) => set('diets', x)} /></Q>
      <Q label="Smoking is okay if"><ChipGroup label="Smoking" multiple options={HABIT_OPTIONS} value={v.smokingOk} onChange={(x) => set('smokingOk', x)} /></Q>
      <Q label="Drinking is okay if"><ChipGroup label="Drinking" multiple options={HABIT_OPTIONS} value={v.drinkingOk} onChange={(x) => set('drinkingOk', x)} /></Q>
      <Q label="Family values"><ChipGroup label="Family values" multiple options={FAMILY_VALUES_OPTIONS} value={v.familyValues} onChange={(x) => set('familyValues', x)} /></Q>
      <Q label="Children"><ChipGroup label="Children" multiple options={CHILDREN_OPTIONS} value={v.childrenPreferences} onChange={(x) => set('childrenPreferences', x)} /></Q>
      <Q label="Living arrangement"><ChipGroup label="Living arrangement" multiple options={LIVING_OPTIONS} value={v.livingArrangements} onChange={(x) => set('livingArrangements', x)} /></Q>
      <Q label="Values that matter in a partner"><ChipGroup label="Partner values" multiple max={8} options={VALUES} value={v.coreValues} onChange={(x) => set('coreValues', x)} /></Q>
      <Q label="Non-negotiables" help="Only these are strict filters. Everything else stays flexible.">
        <ChipGroup label="Non-negotiables" multiple options={NN} value={v.nonNegotiables} onChange={(x) => set('nonNegotiables', x)} />
      </Q>
      <Notice>Fewer non-negotiables usually means more meaningful matches. Compatibility is always checked in both directions.</Notice>
      <TextField label="Anything else, in your own words" optional multiline maxLength={1000} value={v.freeText} onChangeText={(t) => set('freeText', t)} />
      <Footer busy={busy} error={error} label={submitLabel} onPress={go} />
    </View>
  );
}
