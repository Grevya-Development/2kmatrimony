'use client';
import * as React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import {
  CHILDREN_OPTIONS, DIET_OPTIONS, EDUCATION_LEVEL_OPTIONS, FAMILY_VALUES_OPTIONS, INCOME_RANGE_OPTIONS, INTEREST_SUGGESTIONS,
  LANGUAGES, MARITAL_STATUS_OPTIONS, RELOCATION_OPTIONS, SETTLE_OPTIONS, type SearchFilters,
} from '@2k/shared';
import { Badge, Button, ChipGroup, Field, Input, Label, NativeSelect, Slider, Switch, TagInput } from '@/components/ui';

type Props = { value: SearchFilters; onChange: (f: SearchFilters) => void; onApply: () => void; onReset: () => void; advanced: boolean };

function Section({ title, children, locked }: { title: string; children: React.ReactNode; locked?: boolean }) {
  return (
    <fieldset className="space-y-3 border-t border-line pt-5 first:border-t-0 first:pt-0" disabled={locked}>
      <legend className="flex items-center gap-2 text-sm font-medium text-ink">{title}{locked && <Badge tone="gold"><Lock />Plus</Badge>}</legend>
      <div className={locked ? 'pointer-events-none opacity-50' : undefined}>{children}</div>
    </fieldset>
  );
}

const arr = <T,>(v: T[] | undefined) => v ?? [];
const opt = <T,>(v: T[]) => (v.length ? v : undefined);

/** Traditional discovery filters. Advanced filters are marked and gated by plan. */
export function FiltersPanel({ value: f, onChange, onApply, onReset, advanced }: Props) {
  const set = (patch: Partial<SearchFilters>) => onChange({ ...f, ...patch });
  const age: [number, number] = [f.ageMin ?? 21, f.ageMax ?? 40];
  const height: [number, number] = [f.heightMinCm ?? 150, f.heightMaxCm ?? 190];

  return (
    <form onSubmit={(e) => { e.preventDefault(); onApply(); }} className="space-y-5">
      <Section title={`Age · ${age[0]}–${age[1]}`}>
        <Slider min={18} max={70} step={1} value={age} onValueChange={(v) => set({ ageMin: v[0], ageMax: v[1] })} thumbLabels={['Minimum age', 'Maximum age']} />
      </Section>
      <Section title="Location">
        <TagInput label="Cities" value={arr(f.cities)} onChange={(v) => set({ cities: opt(v) })} placeholder="Type a city and press Enter" suggestions={['Bengaluru', 'Chennai', 'Hyderabad', 'Mumbai', 'Pune', 'Delhi', 'Kochi', 'Mysuru']} max={20} />
      </Section>
      <Section title="Marital status">
        <ChipGroup label="Marital status" multiple options={MARITAL_STATUS_OPTIONS} value={arr(f.maritalStatuses)} onChange={(v) => set({ maritalStatuses: opt(v) })} />
      </Section>
      <Section title="Education">
        <ChipGroup label="Education" multiple options={EDUCATION_LEVEL_OPTIONS} value={arr(f.educationLevels)} onChange={(v) => set({ educationLevels: opt(v) })} />
      </Section>
      <Section title="Food preferences">
        <ChipGroup label="Diet" multiple options={DIET_OPTIONS} value={arr(f.diets)} onChange={(v) => set({ diets: opt(v) })} />
      </Section>
      <Section title="Mother tongue">
        <ChipGroup label="Mother tongue" multiple options={LANGUAGES.map((l) => ({ value: l, label: l }))} value={arr(f.motherTongues) as (typeof LANGUAGES)[number][]} onChange={(v) => set({ motherTongues: opt(v) })} />
      </Section>
      <Section title="Interests">
        <TagInput label="Interests" value={arr(f.interests)} onChange={(v) => set({ interests: opt(v) })} suggestions={INTEREST_SUGGESTIONS} max={10} placeholder="Travel, music, hiking…" />
      </Section>
      <Section title="Photos">
        <div className="flex items-center justify-between"><Label htmlFor="with-photo">Only profiles with photos</Label><Switch id="with-photo" checked={!!f.withPhotoOnly} onCheckedChange={(v) => set({ withPhotoOnly: v || undefined })} /></div>
      </Section>

      <div className="rounded-2xl border border-gold-200 bg-gold-50/60 p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-serif text-xl">Advanced filters</p>
          {!advanced && <Button variant="link" size="sm" asChild><Link href="/app/billing">Unlock with Plus</Link></Button>}
        </div>
        <div className="space-y-5">
          <Section title={`Height · ${height[0]}–${height[1]} cm`} locked={!advanced}>
            <Slider min={130} max={210} step={1} value={height} onValueChange={(v) => set({ heightMinCm: v[0], heightMaxCm: v[1] })} thumbLabels={['Minimum height', 'Maximum height']} />
          </Section>
          <Section title="Verified ID only" locked={!advanced}>
            <div className="flex items-center justify-between"><Label htmlFor="verified-only">Show only ID-verified members</Label><Switch id="verified-only" checked={!!f.verifiedOnly} onCheckedChange={(v) => set({ verifiedOnly: v || undefined })} /></div>
          </Section>
          <Section title="Profession" locked={!advanced}>
            <TagInput label="Professions" value={arr(f.professions)} onChange={(v) => set({ professions: opt(v) })} placeholder="Doctor, designer, engineer…" max={10} />
          </Section>
          <Section title="Minimum income" locked={!advanced}>
            <Field label="Annual income at least" htmlFor="min-income">
              <NativeSelect value={f.minIncomeRange ?? ''} onChange={(e) => set({ minIncomeRange: (e.target.value || undefined) as SearchFilters['minIncomeRange'] })}>
                <option value="">Any</option>
                {INCOME_RANGE_OPTIONS.filter((o) => o.value !== 'prefer_not' && o.value !== 'none').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </NativeSelect>
            </Field>
          </Section>
          <Section title="Family values" locked={!advanced}>
            <ChipGroup label="Family values" multiple options={FAMILY_VALUES_OPTIONS} value={arr(f.familyValues)} onChange={(v) => set({ familyValues: opt(v) })} />
          </Section>
          <Section title="Children" locked={!advanced}>
            <ChipGroup label="Children" multiple options={CHILDREN_OPTIONS} value={arr(f.childrenPreferences)} onChange={(v) => set({ childrenPreferences: opt(v) })} />
          </Section>
          <Section title="Where they hope to settle" locked={!advanced}>
            <ChipGroup label="Settle preference" multiple options={SETTLE_OPTIONS} value={arr(f.settlePreferences)} onChange={(v) => set({ settlePreferences: opt(v) })} />
          </Section>
          <Section title="Open to relocating" locked={!advanced}>
            <ChipGroup label="Relocation" multiple options={RELOCATION_OPTIONS} value={arr(f.relocation)} onChange={(v) => set({ relocation: opt(v) })} />
          </Section>
          <Section title="Keywords" locked={!advanced}>
            <Input aria-label="Keywords" maxLength={300} value={f.text ?? ''} onChange={(e) => set({ text: e.target.value || undefined })} placeholder="e.g. classical music, startup, volunteering" />
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-line bg-canvas/95 py-3 backdrop-blur">
        <Button type="submit" className="flex-1">Show results</Button>
        <Button type="button" variant="ghost" onClick={onReset}>Reset</Button>
      </div>
    </form>
  );
}
