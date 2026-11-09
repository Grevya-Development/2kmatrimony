'use client';
import * as React from 'react';
import { X } from 'lucide-react';
import {
  CHILDREN_OPTIONS, CORE_VALUES, DIET_OPTIONS, EDUCATION_LEVEL_OPTIONS, INTEREST_SUGGESTIONS, MARITAL_STATUS_OPTIONS,
  RELOCATION_OPTIONS, SETTLE_OPTIONS, labelOf, type Option, type SearchFilters,
} from '@2k/shared';
import { Button, ChipGroup, Dialog, DialogContent, Field, Input, Switch, TagInput } from '@/components/ui';

const valueOptions: Option<(typeof CORE_VALUES)[number]>[] = CORE_VALUES.map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }));

/** Human-readable chips for the active filters. */
export function describeFilters(f: SearchFilters): { key: keyof SearchFilters; label: string }[] {
  const out: { key: keyof SearchFilters; label: string }[] = [];
  if (f.ageMin !== undefined || f.ageMax !== undefined) out.push({ key: 'ageMin', label: `Age ${f.ageMin ?? 18}–${f.ageMax ?? 99}` });
  if (f.cities?.length) out.push({ key: 'cities', label: [...new Set(f.cities)].slice(0, 3).join(', ') });
  if (f.diets?.length) out.push({ key: 'diets', label: f.diets.map((d) => labelOf(DIET_OPTIONS, d)).join(' / ') });
  if (f.maritalStatuses?.length) out.push({ key: 'maritalStatuses', label: f.maritalStatuses.map((m) => labelOf(MARITAL_STATUS_OPTIONS, m)).join(' / ') });
  if (f.educationLevels?.length) out.push({ key: 'educationLevels', label: `Education: ${labelOf(EDUCATION_LEVEL_OPTIONS, f.educationLevels[0])}${f.educationLevels.length > 1 ? ' +' : ''}` });
  if (f.professions?.length) out.push({ key: 'professions', label: f.professions.join(', ') });
  if (f.motherTongues?.length) out.push({ key: 'motherTongues', label: `${f.motherTongues.join('/')} speaking` });
  if (f.interests?.length) out.push({ key: 'interests', label: `Into ${f.interests.join(', ').toLowerCase()}` });
  if (f.coreValues?.length) out.push({ key: 'coreValues', label: `Values ${f.coreValues.join(', ')}` });
  if (f.relocation?.length) out.push({ key: 'relocation', label: 'Open to relocating' });
  if (f.settlePreferences?.length) out.push({ key: 'settlePreferences', label: `Settle: ${f.settlePreferences.map((s) => labelOf(SETTLE_OPTIONS, s).toLowerCase()).join(' / ')}` });
  if (f.childrenPreferences?.length) out.push({ key: 'childrenPreferences', label: `Children: ${f.childrenPreferences.map((c) => labelOf(CHILDREN_OPTIONS, c).toLowerCase()).join(' / ')}` });
  if (f.verifiedOnly) out.push({ key: 'verifiedOnly', label: 'Verified only' });
  if (f.withPhotoOnly) out.push({ key: 'withPhotoOnly', label: 'With photo' });
  return out;
}

export function removeFilter(f: SearchFilters, key: keyof SearchFilters): SearchFilters {
  const next = { ...f };
  delete next[key];
  if (key === 'ageMin') delete next.ageMax;
  return next;
}

/** Removable chips + an "Edit" dialog for reviewing extracted filters before applying. */
export function FilterReview({ filters, softPreferences, onChange, onApply, applying, applyLabel = 'Apply filters' }: {
  filters: SearchFilters; softPreferences: string[]; onChange: (f: SearchFilters, soft: string[]) => void; onApply: () => void; applying?: boolean; applyLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const chips = describeFilters(filters);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Search filters">
        {chips.length === 0 && softPreferences.length === 0 && <p className="text-sm text-muted">No filters yet.</p>}
        {chips.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink">
            {c.label}
            <button type="button" aria-label={`Remove ${c.label}`} className="text-muted hover:text-ink" onClick={() => onChange(removeFilter(filters, c.key), softPreferences)}><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
        {softPreferences.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-3 py-1 text-sm text-ink" title="Used for ranking, not filtering">
            ~ {s}
            <button type="button" aria-label={`Remove ${s}`} className="text-muted hover:text-ink" onClick={() => onChange(filters, softPreferences.filter((x) => x !== s))}><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onApply} loading={applying}>{applyLabel}</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Edit filters</Button>
          <DialogContent title="Review filters" description="Adjust anything before searching. Items marked ~ only affect ranking." side="right">
            <FilterForm filters={filters} softPreferences={softPreferences} onSave={(f, s) => { onChange(f, s); setOpen(false); }} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function FilterForm({ filters, softPreferences, onSave }: { filters: SearchFilters; softPreferences: string[]; onSave: (f: SearchFilters, soft: string[]) => void }) {
  const [f, setF] = React.useState<SearchFilters>(filters);
  const [soft, setSoft] = React.useState<string[]>(softPreferences);
  const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) =>
    setF((prev) => { const n = { ...prev }; if (v === undefined || (Array.isArray(v) && v.length === 0) || v === false) delete n[k]; else n[k] = v; return n; });
  const num = (v: string) => (v === '' ? undefined : Math.max(18, Math.min(99, Number(v))));
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onSave(f, soft); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Minimum age" htmlFor="f-agemin"><Input type="number" min={18} max={99} value={f.ageMin ?? ''} onChange={(e) => set('ageMin', num(e.target.value))} /></Field>
        <Field label="Maximum age" htmlFor="f-agemax"><Input type="number" min={18} max={99} value={f.ageMax ?? ''} onChange={(e) => set('ageMax', num(e.target.value))} /></Field>
      </div>
      <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Cities</p><TagInput label="Cities" value={f.cities ?? []} onChange={(v) => set('cities', v)} placeholder="Add a city" /></div>
      <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Diet</p><ChipGroup label="Diet" multiple options={DIET_OPTIONS} value={f.diets ?? []} onChange={(v) => set('diets', v)} /></div>
      <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Marital status</p><ChipGroup label="Marital status" multiple options={MARITAL_STATUS_OPTIONS} value={f.maritalStatuses ?? []} onChange={(v) => set('maritalStatuses', v)} /></div>
      <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Education</p><ChipGroup label="Education" multiple options={EDUCATION_LEVEL_OPTIONS} value={f.educationLevels ?? []} onChange={(v) => set('educationLevels', v)} /></div>
      <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Interests</p><TagInput label="Interests" value={f.interests ?? []} onChange={(v) => set('interests', v)} suggestions={INTEREST_SUGGESTIONS} max={10} /></div>
      <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Values <span className="font-normal text-muted">(Plus)</span></p><ChipGroup label="Values" multiple max={8} options={valueOptions} value={f.coreValues ?? []} onChange={(v) => set('coreValues', v)} /></div>
      <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Relocation <span className="font-normal text-muted">(Plus)</span></p><ChipGroup label="Relocation" multiple options={RELOCATION_OPTIONS} value={f.relocation ?? []} onChange={(v) => set('relocation', v)} /></div>
      <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Where to settle <span className="font-normal text-muted">(Plus)</span></p><ChipGroup label="Where to settle" multiple options={SETTLE_OPTIONS} value={f.settlePreferences ?? []} onChange={(v) => set('settlePreferences', v)} /></div>
      <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Children <span className="font-normal text-muted">(Plus)</span></p><ChipGroup label="Children" multiple options={CHILDREN_OPTIONS} value={f.childrenPreferences ?? []} onChange={(v) => set('childrenPreferences', v)} /></div>
      <label className="flex items-center justify-between gap-4 text-sm text-ink-2">With a photo <Switch checked={!!f.withPhotoOnly} onCheckedChange={(v) => set('withPhotoOnly', v)} /></label>
      <label className="flex items-center justify-between gap-4 text-sm text-ink-2">Verified only <span className="text-muted">(Plus)</span><Switch checked={!!f.verifiedOnly} onCheckedChange={(v) => set('verifiedOnly', v)} /></label>
      <div className="space-y-2"><p className="text-sm font-medium text-ink-2">Qualities (ranking only)</p><TagInput label="Qualities" value={soft} onChange={setSoft} placeholder="e.g. kind, ambitious" max={10} /></div>
      <Button type="submit" className="w-full">Save filters</Button>
    </form>
  );
}
