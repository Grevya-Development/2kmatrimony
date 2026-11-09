'use client';
import * as React from 'react';
import { AUDIENCE_OPTIONS, careerSchema, EMPLOYMENT_TYPE_OPTIONS, INCOME_RANGE_OPTIONS, RELOCATION_OPTIONS, type CareerInput } from '@2k/shared';
import { Field, Input } from '@/components/ui';
import { FormActions, FormSection, SelectField, useSectionSave, type SectionFormProps } from './form-kit';

export function CareerForm({ initial, subject, submitLabel, onSaved, onSkip }: SectionFormProps<CareerInput>) {
  const [v, setV] = React.useState<Partial<CareerInput>>({ incomeVisibility: 'connections', ...initial });
  const set = <K extends keyof CareerInput>(k: K, val: CareerInput[K] | null) => setV((p) => ({ ...p, [k]: val }));
  const { errors, saving, save } = useSectionSave(careerSchema, '/profile/career');
  return (
    <form noValidate onSubmit={async (e) => { e.preventDefault(); const r = await save(v); if (r.ok) onSaved?.(r.completion); }} className="space-y-8">
      <FormSection title="Work & ambitions">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Profession" htmlFor="profession" optional error={errors.profession}><Input placeholder="e.g. Architect, Doctor, Founder" value={v.profession ?? ''} onChange={(e) => set('profession', e.target.value)} /></Field>
          <SelectField id="employmentType" label="Work type" optional value={v.employmentType} onChange={(x) => set('employmentType', x)} options={EMPLOYMENT_TYPE_OPTIONS} />
          <Field label="Company" htmlFor="company" optional><Input autoComplete="organization" value={v.company ?? ''} onChange={(e) => set('company', e.target.value)} /></Field>
          <Field label="Designation" htmlFor="designation" optional><Input autoComplete="organization-title" value={v.designation ?? ''} onChange={(e) => set('designation', e.target.value)} /></Field>
          <Field label="Work city" htmlFor="workCity" optional><Input value={v.workCity ?? ''} onChange={(e) => set('workCity', e.target.value)} /></Field>
          <Field label="Work country code" htmlFor="workCountry" optional><Input maxLength={2} value={v.workCountry ?? ''} onChange={(e) => set('workCountry', e.target.value.toUpperCase())} /></Field>
        </div>
        <SelectField id="relocationWillingness" label={`Would ${subject.you} relocate after marriage?`} optional value={v.relocationWillingness} onChange={(x) => set('relocationWillingness', x)} options={RELOCATION_OPTIONS} />
      </FormSection>
      <FormSection title="Income" description="Shown as a range only, and only to the audience you choose.">
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField id="incomeRange" label="Annual income" optional value={v.incomeRange} onChange={(x) => set('incomeRange', x)} options={INCOME_RANGE_OPTIONS} />
          <SelectField id="incomeVisibility" label="Who can see this?" value={v.incomeVisibility} onChange={(x) => set('incomeVisibility', x ?? 'connections')} options={AUDIENCE_OPTIONS} placeholder="Choose" />
        </div>
      </FormSection>
      <FormActions saving={saving} submitLabel={submitLabel} onSkip={onSkip} />
    </form>
  );
}
