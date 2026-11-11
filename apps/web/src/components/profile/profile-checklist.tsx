'use client';
import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { PROFILE_CHECKLIST, type CompletionReport, type OwnProfileResponse } from '@2k/shared';
import { api } from '@/lib/api';
import { Progress } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Order in which we ask for the rest of the profile after onboarding. */
const ORDER = ['photos', 'about', 'values', 'dna', 'career', 'education', 'family', 'lifestyle', 'basics', 'preferences'];

export function hrefForSection(section: string): string {
  if (section === 'photos') return '/app/profile#photos';
  if (section === 'dna') return '/app/dna';
  if (section === 'about') return '/app/profile?edit=basics';
  return `/app/profile?edit=${section}`;
}

/**
 * "Complete your profile": the details we no longer ask for during onboarding,
 * one short section at a time. Hidden once everything is filled in.
 */
export function ProfileChecklist({ completion, title = 'Complete your profile', className, limit = 3 }: {
  completion?: CompletionReport | null; title?: string; className?: string; limit?: number;
}) {
  const [loaded, setLoaded] = React.useState<CompletionReport | null>(null);
  const [all, setAll] = React.useState(false);
  React.useEffect(() => {
    if (completion !== undefined) return;
    let cancelled = false;
    api<OwnProfileResponse>('/profile').then((p) => { if (!cancelled) setLoaded(p.completion); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [completion]);

  const c = completion ?? loaded;
  if (!c) return null;
  const items = c.missing
    .filter((m) => PROFILE_CHECKLIST[m.section])
    .sort((a, b) => ORDER.indexOf(a.section) - ORDER.indexOf(b.section));
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, limit);

  return (
    <section aria-labelledby="checklist-title" className={cn('rounded-2xl border border-line bg-surface p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="checklist-title" className="font-serif text-2xl text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">Each section takes a minute or two. The more we know, the better our introductions.</p>
        </div>
        <span className="text-sm text-muted">{c.pct}% complete</span>
      </div>
      <Progress value={c.pct} label="Profile strength" className="mt-4 h-1.5" />
      <ul className="mt-4 divide-y divide-line">
        {shown.map((m) => {
          const meta = PROFILE_CHECKLIST[m.section]!;
          return (
            <li key={m.section}>
              <Link href={hrefForSection(m.section)} className="group flex items-center gap-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink group-hover:text-emerald-700">{meta.title}{m.required && <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-warning">Needed</span>}</span>
                  <span className="block text-sm text-muted">{meta.why}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">~{meta.minutes} min</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {items.length > limit && (
        <button type="button" onClick={() => setAll((x) => !x)} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
          {all ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}
