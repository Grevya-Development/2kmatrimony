'use client';
import * as React from 'react';
import {
  CHILDREN_OPTIONS, CORE_VALUES, DIET_OPTIONS, EDUCATION_LEVEL_OPTIONS, FAMILY_VALUES_OPTIONS, GENDER_OPTIONS, HABIT_OPTIONS,
  INCOME_RANGE_OPTIONS, LANGUAGES, LIVING_OPTIONS, MARITAL_STATUS_OPTIONS, NON_NEGOTIABLE_FIELDS, NON_NEGOTIABLE_LABELS,
  PERSONALITY_TRAITS, partnerPreferencesSchema, type PartnerPreferencesInput,
} from '@2k/shared';
import { ChipGroup, Field, Input, Notice, Slider, Switch, TagInput, Textarea } from '@/components/ui';
import { FormActions, FormSection, SelectField, toOptions, useSectionSave, type SectionFormProps } from './form-kit';

export function PreferencesForm({ initial, subject, submitLabel, onSaved, onSkip }: SectionFormProps<PartnerPreferencesInput>) {
  const [v, setV] = React.useState<Partial<PartnerPreferencesInput>>({
    seekingGenders: [], ageMin: 25, ageMax: 35, maritalStatuses: [], educationLevels: [], professions: [], countries: [], cities: [],
    diets: [], smokingOk: [], drinkingOk: [], familyValues: [], childrenPreferences: [], livingArrangements: [], personalityTraits: [],
    coreValues: [], motherTongues: [], religions: [], nonNegotiables: [], ...initial,
  });
  const set = <K extends keyof PartnerPreferencesInput>(k: K, val: PartnerPreferencesInput[K] | null | undefined) => setV((p) => ({ ...p, [k]: val }));
  const { errors, saving, save } = useSectionSave(partnerPreferencesSchema, '/profile/preferences');
  const multi = <K extends keyof PartnerPreferencesInput>(k: K, label: string, options: { value: string; label: string }[], hint?: string) => (
    <div className="space-y-2"><p className="text-sm font-medium text-ink-2">{label}</p>{hint && <p className="-mt-1 text-xs text-muted">{hint}</p>}
      <ChipGroup multiple label={label} options={options} value={(v[k] as string[] | undefined) ?? []} onChange={(x) => set(k, x as never)} /></div>
  );
  const nn = new Set(v.nonNegotiables ?? []);

  return (
    <form noValidate onSubmit={async (e) => { e.preventDefault(); const r = await save(v); if (r.ok) onSaved?.(r.completion); }} className="space-y-10">
      <Notice>Everything here is flexible unless {subject.you} mark it as a non-negotiable below. Flexible preferences shape ranking; non-negotiables filter.</Notice>
      <FormSection title="The basics">
        <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Looking for</p>
          <ChipGroup multiple label="Looking for" options={GENDER_OPTIONS} value={v.seekingGenders ?? []} onChange={(x) => set('seekingGenders', x)} />
          {errors.seekingGenders && <p className="text-sm text-danger" role="alert">{errors.seekingGenders}</p>}</div>
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink-2">Age: {v.ageMin}–{v.ageMax}</p>
          <Slider min={18} max={70} step={1} value={[v.ageMin ?? 25, v.ageMax ?? 35]} onValueChange={([a, b]) => setV((p) => ({ ...p, ageMin: a, ageMax: b }))} thumbLabels={['Minimum age', 'Maximum age']} />
          {errors.ageMin && <p className="text-sm text-danger" role="alert">{errors.ageMin}</p>}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><p className="text-sm font-medium text-ink-2">Height {v.heightMinCm ? `${v.heightMinCm}–${v.heightMaxCm} cm` : '(any)'}</p>
            <label className="flex items-center gap-2 text-sm text-muted">Set a range <Switch checked={!!v.heightMinCm} onCheckedChange={(on) => setV((p) => ({ ...p, heightMinCm: on ? 155 : null, heightMaxCm: on ? 185 : null }))} aria-label="Set a height range" /></label></div>
          {v.heightMinCm != null && <Slider min={120} max={230} value={[v.heightMinCm, v.heightMaxCm ?? 200]} onValueChange={([a, b]) => setV((p) => ({ ...p, heightMinCm: a, heightMaxCm: b }))} thumbLabels={['Minimum height', 'Maximum height']} />}
        </div>
        {multi('maritalStatuses', 'Marital status', MARITAL_STATUS_OPTIONS, 'Leave empty for any.')}
      </FormSection>
      <FormSection title="Education, work & location">
        {multi('educationLevels', 'Education (at least)', EDUCATION_LEVEL_OPTIONS)}
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField id="minIncomeRange" label="Minimum income" optional value={v.minIncomeRange} onChange={(x) => set('minIncomeRange', x)} options={INCOME_RANGE_OPTIONS.filter((o) => o.value !== 'prefer_not')} placeholder="No preference" />
          <Field label="Countries" htmlFor="countries" optional hint="Two-letter codes, comma separated."><Input value={(v.countries ?? []).join(', ')} onChange={(e) => set('countries', e.target.value.split(',').map((s) => s.trim().toUpperCase()).filter((s) => s.length === 2))} /></Field>
        </div>
        <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Cities</p><TagInput label="Preferred cities" value={v.cities ?? []} onChange={(x) => set('cities', x)} placeholder="Type a city and press Enter" /></div>
        <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Professions</p><TagInput label="Preferred professions" value={v.professions ?? []} onChange={(x) => set('professions', x)} placeholder="Optional" max={10} /></div>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">Open to a partner who would relocate for {subject.self ? 'you' : 'them'}
          <Switch checked={!!v.openToRelocatePartner} onCheckedChange={(on) => set('openToRelocatePartner', on)} aria-label="Open to a partner relocating" /></label>
      </FormSection>
      <FormSection title="Lifestyle & values">
        {multi('diets', 'Food preference', DIET_OPTIONS)}
        {multi('smokingOk', 'Smoking is okay if…', HABIT_OPTIONS)}
        {multi('drinkingOk', 'Drinking is okay if…', HABIT_OPTIONS)}
        {multi('familyValues', 'Family values', FAMILY_VALUES_OPTIONS)}
        {multi('childrenPreferences', 'Views on children', CHILDREN_OPTIONS)}
        {multi('livingArrangements', 'Living after marriage', LIVING_OPTIONS)}
        {multi('coreValues', 'Values you hope they share', toOptions(CORE_VALUES))}
        {multi('personalityTraits', 'Personality you are drawn to', toOptions(PERSONALITY_TRAITS))}
        <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Mother tongue</p><TagInput label="Mother tongues" value={v.motherTongues ?? []} onChange={(x) => set('motherTongues', x)} suggestions={LANGUAGES} max={10} /></div>
        <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Religion</p><TagInput label="Religions" value={v.religions ?? []} onChange={(x) => set('religions', x)} placeholder="Optional" max={10} /></div>
      </FormSection>
      <FormSection title="Non-negotiables" description="Only mark what truly matters. Profiles that don't meet these won't be recommended — a shorter list means more meaningful options.">
        <div className="grid gap-2 sm:grid-cols-2">
          {NON_NEGOTIABLE_FIELDS.map((f) => (
            <label key={f} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm">
              {NON_NEGOTIABLE_LABELS[f]}
              <Switch checked={nn.has(f)} onCheckedChange={(on) => set('nonNegotiables', on ? [...nn, f] : [...nn].filter((x) => x !== f))} aria-label={`${NON_NEGOTIABLE_LABELS[f]} is non-negotiable`} />
            </label>
          ))}
        </div>
      </FormSection>
      <Field label="Anything else?" htmlFor="freeText" optional hint="Describe the person you hope to meet, in your own words."><Textarea maxLength={1000} value={v.freeText ?? ''} onChange={(e) => set('freeText', e.target.value)} /></Field>
      <FormActions saving={saving} submitLabel={submitLabel} onSkip={onSkip} />
    </form>
  );
}
