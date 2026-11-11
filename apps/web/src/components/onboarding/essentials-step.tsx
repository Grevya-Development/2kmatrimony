'use client';
import * as React from 'react';
import { basicsSchema, GENDER_OPTIONS, LANGUAGES, MARITAL_STATUS_OPTIONS, type BasicsInput, type Gender } from '@2k/shared';
import { Button, ChipGroup, Field, Input } from '@/components/ui';
import { SelectField, useSectionSave, type Subject } from '@/components/profile-edit/form-kit';
import type { CompletionReport } from '@2k/shared';

/**
 * Onboarding step 1: only what we need to start introductions.
 * The basics endpoint replaces the whole record, so anything already saved is sent back unchanged.
 */
export function EssentialsStep({ initial, subject, suggestedGender, onSaved }: {
  initial: Partial<BasicsInput>; subject: Subject; suggestedGender: Gender | null; onSaved: (c: CompletionReport | null, basics: Partial<BasicsInput>) => void;
}) {
  const [v, setV] = React.useState<Partial<BasicsInput>>({
    nameVisibility: 'first_name', currentCountry: 'IN', languages: [], ...initial,
    gender: initial.gender ?? suggestedGender ?? undefined,
  });
  const set = <K extends keyof BasicsInput>(k: K, val: BasicsInput[K] | null | undefined) => setV((p) => ({ ...p, [k]: val }));
  const { errors, saving, save } = useSectionSave(basicsSchema, '/profile/basics');
  const maxDob = new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10);
  const ready = !!(v.firstName?.trim() && v.dateOfBirth && v.gender && v.maritalStatus && v.currentCity?.trim());

  return (
    <form noValidate className="space-y-7" onSubmit={async (e) => { e.preventDefault(); const r = await save(v); if (r.ok) onSaved(r.completion, v); }}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" error={errors.firstName}>
          <Input autoComplete={subject.self ? 'given-name' : 'off'} autoFocus value={v.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label="Date of birth" htmlFor="dateOfBirth" error={errors.dateOfBirth} hint="Members only see the age.">
          <Input type="date" max={maxDob} value={v.dateOfBirth ?? ''} onChange={(e) => set('dateOfBirth', e.target.value)} />
        </Field>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink-2">Gender</p>
        <ChipGroup label="Gender" options={GENDER_OPTIONS} value={v.gender ? [v.gender] : []} onChange={(x) => set('gender', x[0])} />
        {errors.gender && <p className="text-sm text-danger" role="alert">{errors.gender}</p>}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink-2">Marital status</p>
        <ChipGroup label="Marital status" options={MARITAL_STATUS_OPTIONS} value={v.maritalStatus ? [v.maritalStatus] : []} onChange={(x) => set('maritalStatus', x[0])} />
        {errors.maritalStatus && <p className="text-sm text-danger" role="alert">{errors.maritalStatus}</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={`City ${subject.you} live in`} htmlFor="currentCity" error={errors.currentCity}>
          <Input autoComplete={subject.self ? 'address-level2' : 'off'} placeholder="e.g. Chennai" value={v.currentCity ?? ''} onChange={(e) => set('currentCity', e.target.value)} />
        </Field>
        <SelectField id="motherTongue" label="Mother tongue" optional value={v.motherTongue ?? null} onChange={(x) => set('motherTongue', x)} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={saving} disabled={!ready}>Continue</Button>
    </form>
  );
}
