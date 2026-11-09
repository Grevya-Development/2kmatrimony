'use client';
import * as React from 'react';
import { Sparkles } from 'lucide-react';
import type { SearchFilters, SmartSearchInterpretation } from '@2k/shared';
import { Button, ErrorState, Notice } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { FilterReview } from './filter-editor';

export interface SmartSearchProps {
  onApply: (filters: SearchFilters, softPreferences: string[]) => void;
}

const EXAMPLES = [
  'Career-oriented people who value family and want to settle in Bangalore',
  'People interested in international travel and personal growth',
  'Someone who values emotional connection and independence',
  'Profiles open to relocating after marriage',
];

/** "Ask in your own words" search: interpret → review/edit → apply. */
export function SmartSearch({ onApply }: SmartSearchProps) {
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [interp, setInterp] = React.useState<SmartSearchInterpretation | null>(null);
  const [filters, setFilters] = React.useState<SearchFilters>({});
  const [soft, setSoft] = React.useState<string[]>([]);

  const interpret = async (q: string) => {
    if (q.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<SmartSearchInterpretation>('/search/smart', { body: { query: q.trim() } });
      setInterp(r);
      setFilters(r.filters);
      setSoft(r.softPreferences);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="smart-search-title" className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-champagne-600" aria-hidden />
        <h2 id="smart-search-title" className="font-serif text-xl">Describe who you’re looking for</h2>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void interpret(query); }} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="smart-query" className="sr-only">Describe who you are looking for</label>
        <input id="smart-query" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={500}
          placeholder="e.g. kind, vegetarian, 28–32, in Chennai, open to relocating"
          className="h-12 flex-1 rounded-xl border border-line bg-canvas px-4 text-[0.95rem] placeholder:text-muted/70 focus:border-burgundy-500 focus:outline-none focus:ring-4 focus:ring-burgundy-100" />
        <Button type="submit" loading={busy} disabled={query.trim().length < 3}>Understand</Button>
      </form>
      {!interp && !busy && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => { setQuery(ex); void interpret(ex); }} className="rounded-full border border-dashed border-line-strong px-3 py-1 text-xs text-muted hover:border-ink-2 hover:text-ink">{ex}</button>
          ))}
        </div>
      )}
      {error && <div className="mt-3"><ErrorState message={error} /></div>}
      {interp && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-ink-2">{interp.summary}</p>
          {interp.clarifyingQuestions.length > 0 && <Notice>{interp.clarifyingQuestions.join(' ')}</Notice>}
          <FilterReview filters={filters} softPreferences={soft} onChange={(f, s) => { setFilters(f); setSoft(s); }} onApply={() => onApply(filters, soft)} applyLabel="Search with these filters" />
          {interp.generator === 'rules' && <p className="text-xs text-muted">Interpreted with simple keyword rules. Review the filters before searching.</p>}
        </div>
      )}
    </section>
  );
}
