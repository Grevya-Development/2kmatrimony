'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { LANGUAGES } from '@2k/shared';
import { cn } from '@/lib/utils';

/**
 * Hero quick start: "I'm looking for a bride/groom, aged x to y, mother tongue z".
 * Choices are saved to localStorage under QUICKSTART_KEY so onboarding can
 * pre-fill partner preferences, then the visitor continues to sign up.
 */
export const QUICKSTART_KEY = 'tk_quickstart';
export interface QuickStart { lookingFor: 'bride' | 'groom'; ageMin: number; ageMax: number; motherTongue: string | null; savedAt: string }

const AGES = Array.from({ length: 43 }, (_, i) => 18 + i); // 18–60

export function QuickStartForm({ signedIn, className }: { signedIn: boolean; className?: string }) {
  const router = useRouter();
  const [lookingFor, setLookingFor] = React.useState<'bride' | 'groom'>('bride');
  const [ageMin, setAgeMin] = React.useState(24);
  const [ageMax, setAgeMax] = React.useState(32);
  const [tongue, setTongue] = React.useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value: QuickStart = {
      lookingFor,
      ageMin: Math.min(ageMin, ageMax),
      ageMax: Math.max(ageMin, ageMax),
      motherTongue: tongue || null,
      savedAt: new Date().toISOString(),
    };
    try { window.localStorage.setItem(QUICKSTART_KEY, JSON.stringify(value)); } catch { /* private mode: continue anyway */ }
    router.push(signedIn ? '/onboarding' : '/login?next=%2Fonboarding');
  };

  const selectCls = 'h-11 w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-9 text-[0.95rem] text-ink transition-colors hover:border-line-strong focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100';

  return (
    <form onSubmit={submit} aria-label="Start your search" className={cn('rounded-2xl bg-white p-5 shadow-[0_24px_60px_-20px_rgb(6_47_46/0.45)] ring-1 ring-black/5 sm:p-6', className)}>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">I’m looking for a</legend>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1" role="radiogroup" aria-label="I’m looking for a">
          {(['bride', 'groom'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={lookingFor === v}
              onClick={() => setLookingFor(v)}
              className={cn(
                'h-10 rounded-md text-sm font-medium capitalize transition-colors',
                lookingFor === v ? 'bg-emerald-600 text-white shadow-sm' : 'text-ink-2 hover:text-ink',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="block">
          <span className="text-sm font-semibold text-ink">Aged</span>
          <span className="relative mt-2 block"><select aria-label="Minimum age" value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} className={cn(selectCls)}>
            {AGES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select><ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /></span>
        </label>
        <span className="pb-3 text-sm text-muted">to</span>
        <label className="block">
          <span className="sr-only">Maximum age</span>
          <span className="relative block"><select aria-label="Maximum age" value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} className={selectCls}>
            {AGES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select><ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /></span>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-ink">Mother tongue</span>
        <span className="relative mt-2 block"><select aria-label="Mother tongue" value={tongue} onChange={(e) => setTongue(e.target.value)} className={cn(selectCls)}>
          <option value="">Any</option>
          {LANGUAGES.filter((l) => l !== 'English').map((l) => <option key={l} value={l}>{l}</option>)}
        </select><ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /></span>
      </label>

      <button type="submit" className="group mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500">
        Let’s begin
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
      <p className="mt-3 text-center text-xs text-muted">Registration and matchmaking are free.</p>
    </form>
  );
}
