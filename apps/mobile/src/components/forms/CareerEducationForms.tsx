import * as React from 'react';
import { View } from 'react-native';
import {
  AUDIENCE_OPTIONS, EDUCATION_LEVEL_OPTIONS, EMPLOYMENT_TYPE_OPTIONS, INCOME_RANGE_OPTIONS, RELOCATION_OPTIONS,
  type CareerInput, type EducationInput, type EducationLevel,
} from '@2k/shared';
import { space } from '@/theme';
import { Button, Card, ChipGroup, Text, TextField } from '@/components/ui';
import { Footer, Q, arr, first, toNum, useSubmit, type FormProps } from './common';

type Edu = EducationInput['items'][number];

export function EducationForm({ initial, onSubmit, submitLabel, onSkip }: FormProps<EducationInput>) {
  const [items, setItems] = React.useState<Edu[]>(initial.items?.length ? initial.items : [{ level: 'bachelors', qualification: '', isHighest: true } as Edu]);
  const { busy, error, submit } = useSubmit(onSubmit);
  const upd = (i: number, patch: Partial<Edu>) => setItems((p) => p.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <View style={{ gap: space.lg }}>
      {items.map((e, i) => (
        <Card key={i} style={{ gap: space.md }}>
          <Q label="Level"><ChipGroup label="Education level" options={EDUCATION_LEVEL_OPTIONS} value={[e.level]} onChange={(x) => upd(i, { level: (x[0] ?? e.level) as EducationLevel })} /></Q>
          <TextField label="Qualification" value={e.qualification} onChangeText={(t) => upd(i, { qualification: t })} placeholder="e.g. B.Tech, MBA, MBBS" />
          <TextField label="Specialization" optional value={e.specialization ?? ''} onChangeText={(t) => upd(i, { specialization: t || null })} />
          <TextField label="Institution" optional value={e.institution ?? ''} onChangeText={(t) => upd(i, { institution: t || null })} />
          <TextField label="Graduation year" optional keyboardType="number-pad" maxLength={4} value={e.graduationYear?.toString() ?? ''} onChangeText={(t) => upd(i, { graduationYear: toNum(t) })} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={e.isHighest ? 'Highest qualification' : 'Mark as highest'} size="sm" variant={e.isHighest ? 'gold' : 'secondary'} onPress={() => setItems((p) => p.map((x, j) => ({ ...x, isHighest: j === i })))} />
            {items.length > 1 && <Button title="Remove" size="sm" variant="ghost" onPress={() => setItems((p) => p.filter((_, j) => j !== i))} />}
          </View>
        </Card>
      ))}
      {items.length < 6 && <Button title="Add another qualification" variant="secondary" onPress={() => setItems((p) => [...p, { level: 'masters', qualification: '', isHighest: false } as Edu])} />}
      <Footer busy={busy} error={error} label={submitLabel} onSkip={onSkip}
        onPress={() => submit({ items: items.filter((e) => e.qualification.trim()).map((e) => ({ ...e, qualification: e.qualification.trim() })) }, () => (items.some((e) => e.qualification.trim()) ? null : 'Add at least one qualification, or skip.'))} />
    </View>
  );
}

export function CareerForm({ initial, onSubmit, submitLabel, onSkip }: FormProps<CareerInput>) {
  const [v, setV] = React.useState<CareerInput>({
    profession: initial.profession ?? null, employmentType: initial.employmentType ?? null, company: initial.company ?? null, designation: initial.designation ?? null,
    incomeRange: initial.incomeRange ?? null, incomeVisibility: initial.incomeVisibility ?? 'connections', workCity: initial.workCity ?? null, workCountry: initial.workCountry ?? null,
    relocationWillingness: initial.relocationWillingness ?? null,
  });
  const set = <K extends keyof CareerInput>(k: K, val: CareerInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const { busy, error, submit } = useSubmit(onSubmit);
  return (
    <View style={{ gap: space.lg }}>
      <TextField label="Profession" value={v.profession ?? ''} onChangeText={(t) => set('profession', t || null)} placeholder="e.g. Software engineer, Doctor" />
      <Q label="Sector"><ChipGroup label="Sector" options={EMPLOYMENT_TYPE_OPTIONS} value={arr(v.employmentType)} onChange={(x) => set('employmentType', first(x))} /></Q>
      <TextField label="Company" optional value={v.company ?? ''} onChangeText={(t) => set('company', t || null)} />
      <TextField label="Designation" optional value={v.designation ?? ''} onChangeText={(t) => set('designation', t || null)} />
      <TextField label="Work city" optional value={v.workCity ?? ''} onChangeText={(t) => set('workCity', t || null)} />
      <Q label="Annual income" help="Optional. You choose who can see it."><ChipGroup label="Annual income" options={INCOME_RANGE_OPTIONS} value={arr(v.incomeRange)} onChange={(x) => set('incomeRange', first(x))} /></Q>
      <Q label="Who can see your income"><ChipGroup label="Income visibility" options={AUDIENCE_OPTIONS} value={[v.incomeVisibility]} onChange={(x) => set('incomeVisibility', x[0] ?? 'connections')} /></Q>
      <Q label="Open to relocating?"><ChipGroup label="Relocation" options={RELOCATION_OPTIONS} value={arr(v.relocationWillingness)} onChange={(x) => set('relocationWillingness', first(x))} /></Q>
      <Footer busy={busy} error={error} label={submitLabel} onSkip={onSkip} onPress={() => submit(v)} />
      <Text variant="small">Employment can be verified later from Verification.</Text>
    </View>
  );
}
