import * as React from 'react';
import { View } from 'react-native';
import { GENDER_OPTIONS, defaultPartnerBasics, type BasicsInput, type PartnerPreferencesInput } from '@2k/shared';
import { space } from '@/theme';
import { ChipGroup, Notice, TextField } from '@/components/ui';
import { Footer, Q, toNum, useSubmit } from './common';

/**
 * Quick-onboarding partner preferences: who they'd like to meet and an age range.
 * `PUT /profile/preferences` replaces the whole record, so saved preferences are carried over
 * and anything never set falls back to the schema defaults.
 */
export function PartnerBasicsForm({ initial, basics, onSubmit, submitLabel = 'Continue', forSelf = true }: {
  initial: Partial<PartnerPreferencesInput> | null;
  basics: Partial<BasicsInput>;
  onSubmit: (values: PartnerPreferencesInput) => Promise<unknown>;
  submitLabel?: string;
  forSelf?: boolean;
}) {
  const [v, setV] = React.useState(() => {
    const saved = initial?.seekingGenders?.length ? initial : null;
    const d = defaultPartnerBasics(basics.gender, basics.dateOfBirth);
    return {
      seekingGenders: saved?.seekingGenders ?? d.seekingGenders,
      ageMin: String(saved?.ageMin ?? d.ageMin),
      ageMax: String(saved?.ageMax ?? d.ageMax),
    };
  });
  const { busy, error, submit } = useSubmit(onSubmit);
  const p = initial ?? {};

  const go = () => submit({
    ...p,
    maritalStatuses: p.maritalStatuses ?? [], educationLevels: p.educationLevels ?? [], professions: p.professions ?? [], countries: p.countries ?? [],
    cities: p.cities ?? [], diets: p.diets ?? [], smokingOk: p.smokingOk ?? [], drinkingOk: p.drinkingOk ?? [], familyValues: p.familyValues ?? [],
    childrenPreferences: p.childrenPreferences ?? [], livingArrangements: p.livingArrangements ?? [], personalityTraits: p.personalityTraits ?? [],
    coreValues: p.coreValues ?? [], motherTongues: p.motherTongues ?? [], religions: p.religions ?? [], nonNegotiables: p.nonNegotiables ?? [],
    seekingGenders: v.seekingGenders, ageMin: toNum(v.ageMin) ?? 18, ageMax: toNum(v.ageMax) ?? 99,
  } as PartnerPreferencesInput, () => {
    if (!v.seekingGenders.length) return forSelf ? 'Choose who you’d like to meet.' : 'Choose who they’d like to meet.';
    const a = toNum(v.ageMin), b = toNum(v.ageMax);
    if (a === null || b === null || a < 18 || b > 99 || a > b) return 'Enter a valid age range (18–99).';
    return null;
  });

  return (
    <View style={{ gap: space.lg }}>
      <Q label="Looking for">
        <ChipGroup label="Looking for" multiple options={GENDER_OPTIONS} value={v.seekingGenders} onChange={(x) => setV((s) => ({ ...s, seekingGenders: x }))} />
      </Q>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><TextField label="Age from" keyboardType="number-pad" maxLength={2} value={v.ageMin} onChangeText={(t) => setV((s) => ({ ...s, ageMin: t }))} /></View>
        <View style={{ flex: 1 }}><TextField label="Age to" keyboardType="number-pad" maxLength={2} value={v.ageMax} onChangeText={(t) => setV((s) => ({ ...s, ageMax: t }))} /></View>
      </View>
      <Notice>You can add more preferences anytime from your profile.</Notice>
      <Footer busy={busy} error={error} onPress={go} label={submitLabel} />
    </View>
  );
}
