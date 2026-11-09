'use client';
import * as React from 'react';
import { DIET_OPTIONS, FITNESS_OPTIONS, HABIT_OPTIONS, INTEREST_SUGGESTIONS, lifestyleSchema, TRAVEL_OPTIONS, type LifestyleInput } from '@2k/shared';
import { ChipGroup, TagInput } from '@/components/ui';
import { FormActions, FormSection, useSectionSave, type SectionFormProps } from './form-kit';

export function LifestyleForm({ initial, subject, submitLabel, onSaved, onSkip }: SectionFormProps<LifestyleInput>) {
  const [v, setV] = React.useState<Partial<LifestyleInput>>({ hobbies: [], interests: [], ...initial });
  const set = <K extends keyof LifestyleInput>(k: K, val: LifestyleInput[K] | null | undefined) => setV((p) => ({ ...p, [k]: val }));
  const { saving, save } = useSectionSave(lifestyleSchema, '/profile/lifestyle');
  const chips = <K extends 'diet' | 'smoking' | 'drinking' | 'fitness' | 'travel'>(k: K, label: string, options: { value: string; label: string }[]) => (
    <div className="space-y-2"><p className="text-sm font-medium text-ink-2">{label}</p>
      <ChipGroup label={label} options={options} value={v[k] ? [v[k] as string] : []} onChange={(x) => set(k, (x[0] ?? null) as never)} /></div>
  );
  return (
    <form noValidate onSubmit={async (e) => { e.preventDefault(); const r = await save(v); if (r.ok) onSaved?.(r.completion); }} className="space-y-8">
      <FormSection title="Everyday life">
        {chips('diet', 'Food preference', DIET_OPTIONS)}
        {chips('smoking', 'Smoking', HABIT_OPTIONS)}
        {chips('drinking', 'Drinking', HABIT_OPTIONS)}
        {chips('fitness', 'Fitness', FITNESS_OPTIONS)}
        {chips('travel', 'Travel', TRAVEL_OPTIONS)}
      </FormSection>
      <FormSection title="What lights you up" description={`Shared interests help us suggest conversation starters for ${subject.your} matches.`}>
        <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Interests</p>
          <TagInput label="Interests" value={v.interests ?? []} onChange={(x) => set('interests', x)} suggestions={INTEREST_SUGGESTIONS} placeholder="Type and press Enter" max={20} /></div>
        <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Hobbies</p>
          <TagInput label="Hobbies" value={v.hobbies ?? []} onChange={(x) => set('hobbies', x)} placeholder="e.g. Carnatic vocals, weekend treks" max={15} /></div>
      </FormSection>
      <FormActions saving={saving} submitLabel={submitLabel} onSkip={onSkip} />
    </form>
  );
}
