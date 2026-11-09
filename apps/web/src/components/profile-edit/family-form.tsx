'use client';
import * as React from 'react';
import { FAMILY_STRUCTURE_OPTIONS, FAMILY_VALUES_OPTIONS, familySchema, type FamilyInput } from '@2k/shared';
import { ChipGroup, Field, Input, Textarea } from '@/components/ui';
import { FormActions, FormSection, intOrNull, useSectionSave, type SectionFormProps } from './form-kit';

export function FamilyForm({ initial, subject, submitLabel, onSaved, onSkip }: SectionFormProps<FamilyInput>) {
  const [v, setV] = React.useState<Partial<FamilyInput>>({ ...initial });
  const set = <K extends keyof FamilyInput>(k: K, val: FamilyInput[K] | null) => setV((p) => ({ ...p, [k]: val }));
  const { errors, saving, save } = useSectionSave(familySchema, '/profile/family');
  return (
    <form noValidate onSubmit={async (e) => { e.preventDefault(); const r = await save(v); if (r.ok) onSaved?.(r.completion); }} className="space-y-8">
      <FormSection title="Family" description={`Family details beyond structure and values are shown according to ${subject.your} privacy settings.`}>
        <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Family structure</p>
          <ChipGroup label="Family structure" options={FAMILY_STRUCTURE_OPTIONS} value={v.familyStructure ? [v.familyStructure] : []} onChange={(x) => set('familyStructure', x[0] ?? null)} /></div>
        <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Family values</p>
          <ChipGroup label="Family values" options={FAMILY_VALUES_OPTIONS} value={v.familyValues ? [v.familyValues] : []} onChange={(x) => set('familyValues', x[0] ?? null)} /></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Father's occupation" htmlFor="fatherOccupation" optional><Input value={v.fatherOccupation ?? ''} onChange={(e) => set('fatherOccupation', e.target.value)} /></Field>
          <Field label="Mother's occupation" htmlFor="motherOccupation" optional><Input value={v.motherOccupation ?? ''} onChange={(e) => set('motherOccupation', e.target.value)} /></Field>
          <Field label="Brothers" htmlFor="brothers" optional error={errors.brothers}><Input type="number" min={0} max={20} value={v.brothers ?? ''} onChange={(e) => set('brothers', intOrNull(e.target.value))} /></Field>
          <Field label="Sisters" htmlFor="sisters" optional error={errors.sisters}><Input type="number" min={0} max={20} value={v.sisters ?? ''} onChange={(e) => set('sisters', intOrNull(e.target.value))} /></Field>
          <Field label="Family lives in" htmlFor="familyLocation" optional><Input value={v.familyLocation ?? ''} onChange={(e) => set('familyLocation', e.target.value)} /></Field>
          <Field label="Family native place" htmlFor="familyNativePlace" optional><Input value={v.familyNativePlace ?? ''} onChange={(e) => set('familyNativePlace', e.target.value)} /></Field>
        </div>
        <Field label="Siblings" htmlFor="siblingsDetails" optional hint="e.g. Elder sister, married, lives in Pune."><Input value={v.siblingsDetails ?? ''} onChange={(e) => set('siblingsDetails', e.target.value)} /></Field>
        <Field label="About the family" htmlFor="familyBackground" optional><Textarea maxLength={1000} value={v.familyBackground ?? ''} onChange={(e) => set('familyBackground', e.target.value)} /></Field>
      </FormSection>
      <FormActions saving={saving} submitLabel={submitLabel} onSkip={onSkip} />
    </form>
  );
}
