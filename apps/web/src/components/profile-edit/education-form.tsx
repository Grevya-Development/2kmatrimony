'use client';
import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EDUCATION_LEVEL_OPTIONS, educationSchema, type EducationInput } from '@2k/shared';
import { Button, Card, Field, Input } from '@/components/ui';
import { FormActions, FormSection, intOrNull, SelectField, useSectionSave, type SectionFormProps } from './form-kit';

type Item = EducationInput['items'][number];
const blank = (): Partial<Item> => ({ level: undefined, qualification: '', institution: null, specialization: null, graduationYear: null, isHighest: false });

export function EducationForm({ initial, subject, submitLabel, onSaved, onSkip }: SectionFormProps<{ items: Item[] }> & { initial: { items?: Item[] } }) {
  const [items, setItems] = React.useState<Partial<Item>[]>(initial.items?.length ? initial.items : [{ ...blank(), isHighest: true }]);
  const { errors, saving, save } = useSectionSave(educationSchema, '/profile/education');
  const update = (i: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : patch.isHighest ? { ...x, isHighest: false } : x)));
  const filled = items.filter((x) => x.level || x.qualification);

  return (
    <form noValidate onSubmit={async (e) => { e.preventDefault(); const r = await save({ items: filled }); if (r.ok) onSaved?.(r.completion); }} className="space-y-6">
      <FormSection title="Education" description={`Add ${subject.your} highest qualification first. Add more if ${subject.you} like.`}>
        {items.map((it, i) => (
          <Card key={i} className="space-y-4 p-5 shadow-none">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink-2">Qualification {i + 1}</p>
              {items.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remove qualification ${i + 1}`}><Trash2 />Remove</Button>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField id={`edu-level-${i}`} label="Level" value={it.level} onChange={(x) => update(i, { level: x ?? undefined })} options={EDUCATION_LEVEL_OPTIONS} />
              <Field label="Degree / qualification" htmlFor={`edu-q-${i}`}><Input placeholder="e.g. B.Tech, MBA, MBBS" value={it.qualification ?? ''} onChange={(e) => update(i, { qualification: e.target.value })} /></Field>
              <Field label="Institution" htmlFor={`edu-inst-${i}`} optional><Input value={it.institution ?? ''} onChange={(e) => update(i, { institution: e.target.value })} /></Field>
              <Field label="Specialisation" htmlFor={`edu-spec-${i}`} optional><Input value={it.specialization ?? ''} onChange={(e) => update(i, { specialization: e.target.value })} /></Field>
              <Field label="Graduation year" htmlFor={`edu-year-${i}`} optional><Input type="number" inputMode="numeric" min={1950} max={2100} value={it.graduationYear ?? ''} onChange={(e) => update(i, { graduationYear: intOrNull(e.target.value) })} /></Field>
              <label className="flex items-center gap-2 self-end pb-3 text-sm text-ink-2">
                <input type="radio" name="highest" checked={!!it.isHighest} onChange={() => update(i, { isHighest: true })} className="accent-emerald-600" /> Highest qualification
              </label>
            </div>
          </Card>
        ))}
        {errors.items && <p className="text-sm text-danger" role="alert">Please complete the level and qualification for each entry.</p>}
        {items.length < 6 && <Button type="button" variant="secondary" onClick={() => setItems((xs) => [...xs, blank()])}><Plus />Add another</Button>}
      </FormSection>
      <FormActions saving={saving} submitLabel={submitLabel} onSkip={onSkip} />
    </form>
  );
}
