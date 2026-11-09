'use client';
import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Option } from '@2k/shared';

/** Toggleable chip group for single or multi select (accessible as checkbox/radio group). */
export function ChipGroup<T extends string>({ options, value, onChange, multiple, max, label, className }: {
  options: Option<T>[]; value: T[]; onChange: (v: T[]) => void; multiple?: boolean; max?: number; label: string; className?: string;
}) {
  const toggle = (v: T) => {
    if (!multiple) return onChange([v]);
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (max && value.length >= max) return;
    onChange([...value, v]);
  };
  return (
    <div role={multiple ? 'group' : 'radiogroup'} aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={active}
            onClick={() => toggle(o.value)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm transition-all duration-200',
              active ? 'border-burgundy-600 bg-burgundy-600 text-white shadow-soft' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Free-form tag input with suggestions. */
export function TagInput({ value, onChange, suggestions = [], placeholder, max = 20, label }: {
  value: string[]; onChange: (v: string[]) => void; suggestions?: readonly string[]; placeholder?: string; max?: number; label: string;
}) {
  const [draft, setDraft] = React.useState('');
  const add = (t: string) => {
    const tag = t.trim();
    if (!tag || value.some((v) => v.toLowerCase() === tag.toLowerCase()) || value.length >= max) return;
    onChange([...value, tag]);
    setDraft('');
  };
  const remaining = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 12);
  return (
    <div className="space-y-3">
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 focus-within:border-burgundy-500 focus-within:ring-4 focus-within:ring-burgundy-100">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-champagne-100 px-3 py-1 text-sm text-ink">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))} className="text-muted hover:text-ink"><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
        <input
          aria-label={label}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
          placeholder={value.length ? '' : placeholder}
          className="min-w-32 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted/70"
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed border-line-strong px-3 py-1 text-xs text-muted hover:border-ink-2 hover:text-ink">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
