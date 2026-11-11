'use client';
import * as React from 'react';
import { GENDER_OPTIONS, partnerPreferencesSchema, type CompletionReport, type PartnerPreferencesInput } from '@2k/shared';
import { Button, ChipGroup, Slider } from '@/components/ui';
import { useSectionSave, type Subject } from '@/components/profile-edit/form-kit';

const EMPTY: Partial<PartnerPreferencesInput> = {
  maritalStatuses: [], educationLevels: [], professions: [], countries: [], cities: [], diets: [], smokingOk: [], drinkingOk: [],
  familyValues: [], childrenPreferences: [], livingArrangements: [], personalityTraits: [], coreValues: [], motherTongues: [], religions: [], nonNegotiables: [],
};

/**
 * Onboarding step 2: who they hope to meet — gender and age only. Starts from saved
 * preferences, the landing page quick-start, or sensible defaults. Detailed
 * preferences are added later from the profile.
 */
export function PartnerStep({ initial, subject, onSaved, onBack }: {
  initial: Partial<PartnerPreferencesInput>; subject: Subject; onSaved: (c: CompletionReport | null) => void; onBack: () => void;
}) {
  const [v, setV] = React.useState<Partial<PartnerPreferencesInput>>({ ...EMPTY, ...initial });
  const { errors, saving, save } = useSectionSave(partnerPreferencesSchema, '/profile/preferences');
  const seeking = v.seekingGenders ?? [];

  return (
    <form noValidate className="space-y-9" onSubmit={async (e) => { e.preventDefault(); const r = await save(v); if (r.ok) onSaved(r.completion); }}>
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink-2">Looking for</p>
        <ChipGroup multiple label="Looking for" options={GENDER_OPTIONS} value={seeking} onChange={(x) => setV((p) => ({ ...p, seekingGenders: x }))} />
        {errors.seekingGenders && <p className="text-sm text-danger" role="alert">{errors.seekingGenders}</p>}
      </div>
      <div className="space-y-4">
        <p className="text-sm font-medium text-ink-2">Age between <span className="font-serif text-xl text-ink">{v.ageMin}–{v.ageMax}</span></p>
        <Slider min={18} max={70} step={1} value={[v.ageMin ?? 24, v.ageMax ?? 34]} onValueChange={([a, b]) => setV((p) => ({ ...p, ageMin: a, ageMax: b }))} thumbLabels={['Minimum age', 'Maximum age']} />
        {errors.ageMin && <p className="text-sm text-danger" role="alert">{errors.ageMin}</p>}
      </div>
      <p className="text-sm text-muted">{subject.You} can add education, location, lifestyle and other preferences anytime from {subject.your} profile.</p>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>Back</Button>
        <Button type="submit" size="lg" loading={saving} disabled={!seeking.length}>Continue</Button>
      </div>
    </form>
  );
}
