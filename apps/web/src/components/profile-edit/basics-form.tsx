'use client';
import * as React from 'react';
import { basicsSchema, formatHeight, GENDER_OPTIONS, LANGUAGES, MARITAL_STATUS_OPTIONS, type BasicsInput } from '@2k/shared';
import { ChipGroup, Field, Input, NativeSelect, TagInput, Textarea } from '@/components/ui';
import { FormActions, FormSection, intOrNull, SelectField, useSectionSave, type SectionFormProps } from './form-kit';

export function BasicsForm({ initial, subject, submitLabel, onSaved, onSkip }: SectionFormProps<BasicsInput>) {
  const [v, setV] = React.useState<Partial<BasicsInput>>({ nameVisibility: 'first_name', currentCountry: 'IN', languages: [], ...initial });
  const set = <K extends keyof BasicsInput>(k: K, val: BasicsInput[K] | null | undefined) => setV((p) => ({ ...p, [k]: val }));
  const { errors, saving, save } = useSectionSave(basicsSchema, '/profile/basics');
  const maxDob = new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10);

  return (
    <form noValidate onSubmit={async (e) => { e.preventDefault(); const r = await save(v); if (r.ok) onSaved?.(r.completion); }} className="space-y-8">
      <FormSection title="The essentials" description={`Only signed-in members can see ${subject.your} profile, and ${subject.you} control how ${subject.your} name appears.`}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" error={errors.firstName}><Input autoComplete="given-name" value={v.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)} /></Field>
          <Field label="Last name" htmlFor="lastName" optional error={errors.lastName}><Input autoComplete="family-name" value={v.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)} /></Field>
        </div>
        <Field label="How should the name appear to members?" htmlFor="nameVisibility" hint="Connections always see the full name unless you choose initials.">
          <NativeSelect value={v.nameVisibility} onChange={(e) => set('nameVisibility', e.target.value as BasicsInput['nameVisibility'])}>
            <option value="first_name">First name and last initial</option>
            <option value="full">Full name</option>
            <option value="initials">Initials only</option>
          </NativeSelect>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date of birth" htmlFor="dateOfBirth" error={errors.dateOfBirth} hint="Members see age, never the date."><Input type="date" max={maxDob} value={v.dateOfBirth ?? ''} onChange={(e) => set('dateOfBirth', e.target.value)} /></Field>
          <Field label="Height (cm)" htmlFor="heightCm" optional error={errors.heightCm} hint={v.heightCm ? formatHeight(v.heightCm) : undefined}>
            <Input type="number" inputMode="numeric" min={120} max={230} value={v.heightCm ?? ''} onChange={(e) => set('heightCm', intOrNull(e.target.value))} />
          </Field>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink-2" id="gender-label">Gender</p>
          <ChipGroup label="Gender" options={GENDER_OPTIONS} value={v.gender ? [v.gender] : []} onChange={(x) => set('gender', x[0])} />
          {errors.gender && <p className="text-sm text-danger" role="alert">{errors.gender}</p>}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink-2">Marital status</p>
          <ChipGroup label="Marital status" options={MARITAL_STATUS_OPTIONS} value={v.maritalStatus ? [v.maritalStatus] : []} onChange={(x) => set('maritalStatus', x[0])} />
          {errors.maritalStatus && <p className="text-sm text-danger" role="alert">{errors.maritalStatus}</p>}
        </div>
        {v.maritalStatus && v.maritalStatus !== 'never_married' && (
          <Field label="Children" htmlFor="hasChildren" optional>
            <NativeSelect value={v.hasChildren == null ? '' : v.hasChildren ? 'yes' : 'no'} onChange={(e) => set('hasChildren', e.target.value === '' ? null : e.target.value === 'yes')}>
              <option value="">Prefer not to say</option><option value="no">No children</option><option value="yes">Has children</option>
            </NativeSelect>
          </Field>
        )}
      </FormSection>

      <FormSection title="Where life happens">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Current city" htmlFor="currentCity" error={errors.currentCity}><Input autoComplete="address-level2" value={v.currentCity ?? ''} onChange={(e) => set('currentCity', e.target.value)} /></Field>
          <Field label="State" htmlFor="currentState" optional><Input autoComplete="address-level1" value={v.currentState ?? ''} onChange={(e) => set('currentState', e.target.value)} /></Field>
          <Field label="Country code" htmlFor="currentCountry" hint="Two letters, e.g. IN, AE, US." error={errors.currentCountry}><Input maxLength={2} value={v.currentCountry ?? ''} onChange={(e) => set('currentCountry', e.target.value.toUpperCase())} /></Field>
          <Field label="Native place" htmlFor="nativePlace" optional><Input value={v.nativePlace ?? ''} onChange={(e) => set('nativePlace', e.target.value)} /></Field>
          <Field label="Nationality" htmlFor="nationality" optional><Input value={v.nationality ?? ''} onChange={(e) => set('nationality', e.target.value)} /></Field>
          <SelectField id="motherTongue" label="Mother tongue" optional value={v.motherTongue ?? null} onChange={(x) => set('motherTongue', x)} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink-2">Languages spoken</p>
          <TagInput label="Languages spoken" value={v.languages ?? []} onChange={(x) => set('languages', x)} suggestions={LANGUAGES} placeholder="Type a language and press Enter" max={10} />
        </div>
      </FormSection>

      <FormSection title="Faith & community" description={`Optional and never guessed. Visible only as ${subject.your} privacy settings allow.`}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Religion" htmlFor="religion" optional><Input value={v.religion ?? ''} onChange={(e) => set('religion', e.target.value)} /></Field>
          <Field label="Community" htmlFor="community" optional><Input value={v.community ?? ''} onChange={(e) => set('community', e.target.value)} /></Field>
        </div>
      </FormSection>

      <FormSection title={`In ${subject.your} own words`}>
        <Field label="A short introduction" htmlFor="about" optional error={errors.about} hint={`${(v.about ?? '').length}/2000 · What would ${subject.you} like someone to know first?`}>
          <Textarea maxLength={2000} rows={5} value={v.about ?? ''} onChange={(e) => set('about', e.target.value)} />
        </Field>
      </FormSection>
      <FormActions saving={saving} submitLabel={submitLabel} onSkip={onSkip} />
    </form>
  );
}
