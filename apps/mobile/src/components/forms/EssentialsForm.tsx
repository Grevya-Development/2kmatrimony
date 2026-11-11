import * as React from 'react';
import { View } from 'react-native';
import { GENDER_OPTIONS, MARITAL_STATUS_OPTIONS, isAdultDob, type BasicsInput } from '@2k/shared';
import { space } from '@/theme';
import { ChipGroup, TextField } from '@/components/ui';
import { Footer, Q, arr, first, useSubmit, type FormProps } from './common';

/**
 * The quick-onboarding essentials: name, date of birth, gender, marital status and city.
 * `PUT /profile/basics` replaces the whole record, so anything already saved is carried over.
 */
export function EssentialsForm({ initial, onSubmit, submitLabel = 'Continue', forSelf = true }: FormProps<BasicsInput>) {
  const [dob] = React.useState(() => (initial.dateOfBirth ?? '').split('-'));
  const [v, setV] = React.useState({
    firstName: initial.firstName ?? '', year: dob[0] ?? '', month: dob[1] ?? '', day: dob[2] ?? '',
    gender: initial.gender ?? null, maritalStatus: initial.maritalStatus ?? null,
    currentCity: initial.currentCity ?? '', motherTongue: initial.motherTongue ?? '',
  });
  const set = (k: 'firstName' | 'year' | 'month' | 'day' | 'currentCity' | 'motherTongue') => (val: string) => setV((p) => ({ ...p, [k]: val }));
  const { busy, error, submit } = useSubmit(onSubmit);
  const date = `${v.year.padStart(4, '0')}-${v.month.padStart(2, '0')}-${v.day.padStart(2, '0')}`;

  const go = () => submit({
    ...initial,
    nameVisibility: initial.nameVisibility ?? 'first_name',
    currentCountry: initial.currentCountry ?? 'IN',
    languages: initial.languages ?? [],
    firstName: v.firstName.trim(),
    dateOfBirth: date,
    gender: v.gender!,
    maritalStatus: v.maritalStatus!,
    currentCity: v.currentCity.trim(),
    motherTongue: v.motherTongue.trim() || null,
  } as BasicsInput, () => {
    if (!v.firstName.trim()) return 'First name is required.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) return 'Enter a valid date of birth.';
    if (!isAdultDob(date)) return 'Members must be at least 18 years old.';
    if (!v.gender) return 'Please choose a gender.';
    if (!v.maritalStatus) return 'Please choose a marital status.';
    if (!v.currentCity.trim()) return 'City is required.';
    return null;
  });

  return (
    <View style={{ gap: space.lg }}>
      <TextField label="First name" value={v.firstName} onChangeText={set('firstName')} autoComplete={forSelf ? 'given-name' : 'off'} textContentType={forSelf ? 'givenName' : 'none'} />
      <Q label="Date of birth" help="Only age is shown to other members.">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><TextField label="Day" keyboardType="number-pad" maxLength={2} value={v.day} onChangeText={set('day')} placeholder="DD" /></View>
          <View style={{ flex: 1 }}><TextField label="Month" keyboardType="number-pad" maxLength={2} value={v.month} onChangeText={set('month')} placeholder="MM" /></View>
          <View style={{ flex: 1.4 }}><TextField label="Year" keyboardType="number-pad" maxLength={4} value={v.year} onChangeText={set('year')} placeholder="YYYY" /></View>
        </View>
      </Q>
      <Q label="Gender"><ChipGroup label="Gender" options={GENDER_OPTIONS} value={arr(v.gender)} onChange={(x) => setV((p) => ({ ...p, gender: first(x) }))} /></Q>
      <Q label="Marital status"><ChipGroup label="Marital status" options={MARITAL_STATUS_OPTIONS} value={arr(v.maritalStatus)} onChange={(x) => setV((p) => ({ ...p, maritalStatus: first(x) }))} /></Q>
      <TextField label="Current city" value={v.currentCity} onChangeText={set('currentCity')} placeholder="e.g. Chennai" />
      <TextField label="Mother tongue" optional value={v.motherTongue} onChangeText={set('motherTongue')} placeholder="e.g. Tamil" />
      <Footer busy={busy} error={error} onPress={go} label={submitLabel} />
    </View>
  );
}
