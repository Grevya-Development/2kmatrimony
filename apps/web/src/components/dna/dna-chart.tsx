'use client';
import * as React from 'react';
import { DNA_DIMENSIONS, DNA_DIMENSION_META, type DnaDimension } from '@2k/shared';
import { cn } from '@/lib/utils';

export interface DnaPoint { dimension: DnaDimension; selfScore: number; partnerTarget: number | null; importance: number; flexible: boolean; source?: string }

/**
 * Spectrum visualisation of the ten dimensions: filled dot = self, ring = desired
 * partner position (absent = "similar to me"), bar weight = importance.
 */
export function DnaChart({ points, onSelect, compact }: { points: DnaPoint[]; onSelect?: (d: DnaDimension) => void; compact?: boolean }) {
  const by = new Map(points.map((p) => [p.dimension, p]));
  return (
    <ul className="space-y-1" aria-label="Your Relationship DNA">
      {DNA_DIMENSIONS.map((d) => {
        const meta = DNA_DIMENSION_META[d];
        const p = by.get(d);
        const label = p
          ? `${meta.label}: you are at ${p.selfScore} of 100 between ${meta.left} and ${meta.right}; ${p.partnerTarget === null ? 'partner similar to you' : `partner around ${p.partnerTarget}`}; importance ${p.importance} of 5${p.flexible ? ', flexible' : ''}.`
          : `${meta.label}: not answered yet.`;
        const Row = onSelect ? 'button' : 'div';
        return (
          <li key={d}>
            <Row type={onSelect ? 'button' : undefined} onClick={onSelect ? () => onSelect(d) : undefined} aria-label={onSelect ? `Edit ${label}` : label}
              className={cn('grid w-full grid-cols-1 items-center gap-2 rounded-xl px-3 py-3 text-left sm:grid-cols-[11rem_1fr]', onSelect && 'transition-colors hover:bg-surface-2 focus-visible:bg-surface-2')}>
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                {meta.label}
                {p?.source === 'ai_suggested' && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[0.65rem] text-gold-600">AI-suggested</span>}
              </span>
              <span className="block">
                <svg viewBox="0 0 400 28" className="h-7 w-full" role="presentation" aria-hidden preserveAspectRatio="none">
                  <line x1="8" x2="392" y1="14" y2="14" stroke="var(--color-line-strong)" strokeWidth={p ? 1 + p.importance * 0.9 : 1.5} strokeLinecap="round" opacity={p ? 0.35 + p.importance * 0.13 : 0.4} />
                  {p && p.partnerTarget !== null && (
                    <circle cx={8 + (p.partnerTarget / 100) * 384} cy="14" r="8" fill="var(--color-surface)" stroke="var(--color-gold-600)" strokeWidth="2.5" strokeDasharray={p.flexible ? '3 2' : undefined} />
                  )}
                  {p && <circle cx={8 + (p.selfScore / 100) * 384} cy="14" r="6.5" fill="var(--color-emerald-600)" />}
                </svg>
                {!compact && (
                  <span className="mt-0.5 flex justify-between text-[0.7rem] text-muted"><span>{meta.left}</span><span>{p ? '' : 'Not answered'}</span><span>{meta.right}</span></span>
                )}
              </span>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

export function DnaLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
      <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-600" />You</span>
      <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-gold-600 bg-surface" />Partner you hope for</span>
      <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-dashed border-gold-600" />Flexible</span>
      <span className="flex items-center gap-2"><span className="h-1 w-6 rounded bg-line-strong" />Thicker line = matters more</span>
    </div>
  );
}
