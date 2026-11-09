'use client';
import * as React from 'react';
import {
  CHILDREN_OPTIONS, CORE_VALUES, LIVING_OPTIONS, PERSONALITY_TRAITS, SETTLE_OPTIONS, valuesSchema, type ValuesInput,
} from '@2k/shared';
import { ChipGroup, Field, Textarea } from '@/components/ui';
import { FormActions, FormSection, SelectField, toOptions, useSectionSave, type SectionFormProps } from './form-kit';

const COMMUNICATION = [
  { value: 'frequent_checkins', label: 'Frequent check-ins' }, { value: 'balanced', label: 'A natural balance' },
  { value: 'space_and_depth', label: 'Space, then deep conversations' }, { value: 'direct', label: 'Direct' }, { value: 'gentle', label: 'Gentle' },
];
const CONFLICT = [
  { value: 'talk_immediately', label: 'Talk it through right away' }, { value: 'cool_off_then_talk', label: 'Pause, then talk' },
  { value: 'written', label: 'Write thoughts first' }, { value: 'mediated', label: 'Involve someone we trust' },
];
const FINANCE = [
  { value: 'saver', label: 'Save first' }, { value: 'balanced', label: 'Balanced' }, { value: 'investor', label: 'Invest to grow' },
  { value: 'spender', label: 'Enjoy life now' }, { value: 'shared_pool', label: 'One shared pool' }, { value: 'separate_finances', label: 'Mostly separate' },
];
const INDEPENDENCE = [
  { value: 'very_independent', label: 'Independent, side by side' }, { value: 'balanced', label: 'Balance of together and apart' }, { value: 'very_together', label: 'A close team' },
];
const HOUSEHOLD = [
  { value: 'equal', label: 'Shared equally' }, { value: 'flexible', label: 'Flexible' }, { value: 'traditional', label: 'Traditional roles' }, { value: 'outsourced', label: 'Mostly with help' },
];

export function ValuesForm({ initial, subject, submitLabel, onSaved, onSkip }: SectionFormProps<ValuesInput>) {
  const [v, setV] = React.useState<Partial<ValuesInput>>({ coreValues: [], personalityTraits: [], ...initial });
  const set = <K extends keyof ValuesInput>(k: K, val: ValuesInput[K] | null | undefined) => setV((p) => ({ ...p, [k]: val }));
  const { saving, save } = useSectionSave(valuesSchema, '/profile/values');
  const sel = (k: keyof ValuesInput, label: string, options: { value: string; label: string }[]) => (
    <SelectField id={String(k)} label={label} optional value={(v[k] as string | null | undefined) ?? null} onChange={(x) => set(k, x as never)} options={options} />
  );
  return (
    <form noValidate onSubmit={async (e) => { e.preventDefault(); const r = await save(v); if (r.ok) onSaved?.(r.completion); }} className="space-y-8">
      <FormSection title="Values" description="Explicit answers only — we never infer values from anything else.">
        <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Values that matter most (up to five)</p>
          <ChipGroup multiple max={5} label="Core values" options={toOptions(CORE_VALUES)} value={(v.coreValues ?? []) as string[]} onChange={(x) => set('coreValues', x as ValuesInput['coreValues'])} /></div>
        <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Words that describe {subject.self ? 'you' : 'them'} (up to five)</p>
          <ChipGroup multiple max={5} label="Personality" options={toOptions(PERSONALITY_TRAITS)} value={(v.personalityTraits ?? []) as string[]} onChange={(x) => set('personalityTraits', x as ValuesInput['personalityTraits'])} /></div>
        <div className="grid gap-5 sm:grid-cols-2">
          {sel('communicationStyle', 'Communication style', COMMUNICATION)}
          {sel('conflictStyle', 'When disagreeing', CONFLICT)}
          {sel('financialPhilosophy', 'Money as a couple', FINANCE)}
          {sel('independenceLevel', 'Together vs. independent', INDEPENDENCE)}
          {sel('householdSplit', 'Household responsibilities', HOUSEHOLD)}
        </div>
      </FormSection>
      <FormSection title="Future vision">
        <div className="grid gap-5 sm:grid-cols-2">
          {sel('childrenPreference', 'Children', CHILDREN_OPTIONS)}
          {sel('livingArrangement', 'Living after marriage', LIVING_OPTIONS)}
          {sel('settlePreference', 'Where to settle', SETTLE_OPTIONS)}
        </div>
      </FormSection>
      <FormSection title="In your own words" description="All optional — a sentence or two is perfect.">
        {([
          ['emotionalExpectations', 'What helps you feel understood and cared for?'],
          ['relationshipExpectations', 'What does a good marriage look like to you?'],
          ['familyResponsibilities', 'Family responsibilities a partner should know about'],
          ['careerAmbitions', 'What are you working towards in your career?'],
          ['futureGoals', 'A few things you hope to do in the next five years'],
        ] as const).map(([k, label]) => (
          <Field key={k} label={subject.self ? label : label.replace(/\byou\b/g, 'they').replace(/\byour\b/g, 'their')} htmlFor={k} optional>
            <Textarea rows={3} maxLength={1000} value={(v[k] as string | null | undefined) ?? ''} onChange={(e) => set(k, e.target.value)} />
          </Field>
        ))}
      </FormSection>
      <FormActions saving={saving} submitLabel={submitLabel} onSkip={onSkip} />
    </form>
  );
}
