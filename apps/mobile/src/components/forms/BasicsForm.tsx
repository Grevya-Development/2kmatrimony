import * as React from 'react';
import { View } from 'react-native';
import { GENDER_OPTIONS, MARITAL_STATUS_OPTIONS, NAME_VISIBILITY, isAdultDob, type BasicsInput } from '@2k/shared';
import { space } from '@/theme';
import { ChipGroup, TextField } from '@/components/ui';
import { Footer, Q, arr, first, toNum, useSubmit, type FormProps } from './common';

const NAME_VIS = NAME_VISIBILITY.map((v) => ({ value: v, label: v === 'full' ? 'Full name' : v === 'first_name' ? 'First name + initial' : 'Initials only' }));

export function BasicsForm({ initial, onSubmit, submitLabel, forSelf = true }: FormProps<BasicsInput>) {
  const [dob] = React.useState(() => (initial.dateOfBirth ?? '').split('-'));
  const [v, setV] = React.useState({
    firstName: initial.firstName ?? '', lastName: initial.lastName ?? '', nameVisibility: initial.nameVisibility ?? 'first_name',
    year: dob[0] ?? '', month: dob[1] ?? '', day: dob[2] ?? '', gender: initial.gender ?? null, heightCm: initial.heightCm?.toString() ?? '',
    maritalStatus: initial.maritalStatus ?? null, motherTongue: initial.motherTongue ?? '', languages: (initial.languages ?? []).join(', '),
    currentCity: initial.currentCity ?? '', currentState: initial.currentState ?? '', nativePlace: initial.nativePlace ?? '',
    religion: initial.religion ?? '', community: initial.community ?? '', about: initial.about ?? '',
  });
  const set = (k: keyof typeof v) => (val: string) => setV((p) => ({ ...p, [k]: val }));
  const { busy, error, submit } = useSubmit(onSubmit);
  const date = `${v.year.padStart(4, '0')}-${v.month.padStart(2, '0')}-${v.day.padStart(2, '0')}`;

  const go = () => submit({
    firstName: v.firstName.trim(), lastName: v.lastName.trim() || null, nameVisibility: v.nameVisibility as BasicsInput['nameVisibility'],
    dateOfBirth: date, gender: v.gender!, heightCm: toNum(v.heightCm), maritalStatus: v.maritalStatus!, hasChildren: initial.hasChildren ?? null,
    motherTongue: v.motherTongue.trim() || null, languages: v.languages.split(',').map((s) => s.trim()).filter(Boolean),
    nationality: initial.nationality ?? null, religion: v.religion.trim() || null, community: v.community.trim() || null,
    currentCity: v.currentCity.trim(), currentState: v.currentState.trim() || null, currentCountry: initial.currentCountry ?? 'IN',
    nativePlace: v.nativePlace.trim() || null, about: v.about.trim() || null,
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
      <TextField label="First name" value={v.firstName} onChangeText={set('firstName')} autoComplete={forSelf ? 'given-name' : 'off'} />
      <TextField label="Last name" optional value={v.lastName} onChangeText={set('lastName')} />
      <Q label="Show name as"><ChipGroup label="Name visibility" options={NAME_VIS} value={[v.nameVisibility as 'full']} onChange={(x) => setV((p) => ({ ...p, nameVisibility: x[0] ?? 'first_name' }))} /></Q>
      <Q label="Date of birth" help="Only age is shown to other members.">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><TextField label="Day" keyboardType="number-pad" maxLength={2} value={v.day} onChangeText={set('day')} placeholder="DD" /></View>
          <View style={{ flex: 1 }}><TextField label="Month" keyboardType="number-pad" maxLength={2} value={v.month} onChangeText={set('month')} placeholder="MM" /></View>
          <View style={{ flex: 1.4 }}><TextField label="Year" keyboardType="number-pad" maxLength={4} value={v.year} onChangeText={set('year')} placeholder="YYYY" /></View>
        </View>
      </Q>
      <Q label="Gender"><ChipGroup label="Gender" options={GENDER_OPTIONS} value={arr(v.gender)} onChange={(x) => setV((p) => ({ ...p, gender: first(x) }))} /></Q>
      <Q label="Marital status"><ChipGroup label="Marital status" options={MARITAL_STATUS_OPTIONS} value={arr(v.maritalStatus)} onChange={(x) => setV((p) => ({ ...p, maritalStatus: first(x) }))} /></Q>
      <TextField label="Height (cm)" optional keyboardType="number-pad" maxLength={3} value={v.heightCm} onChangeText={set('heightCm')} />
      <TextField label="Current city" value={v.currentCity} onChangeText={set('currentCity')} />
      <TextField label="State" optional value={v.currentState} onChangeText={set('currentState')} />
      <TextField label="Native place" optional value={v.nativePlace} onChangeText={set('nativePlace')} />
      <TextField label="Mother tongue" optional value={v.motherTongue} onChangeText={set('motherTongue')} />
      <TextField label="Languages spoken" optional value={v.languages} onChangeText={set('languages')} hint="Separate with commas" />
      <TextField label="Religion" optional value={v.religion} onChangeText={set('religion')} hint="Only if you wish. Never inferred; visibility follows your privacy settings." />
      <TextField label="Community" optional value={v.community} onChangeText={set('community')} />
      <TextField label={forSelf ? 'A short introduction' : 'Introduce them in a few lines'} optional multiline maxLength={2000} value={v.about} onChangeText={set('about')} />
      <Footer busy={busy} error={error} onPress={go} label={submitLabel} />
    </View>
  );
}
