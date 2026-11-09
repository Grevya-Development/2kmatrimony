'use client';
import * as React from 'react';
import { MessageCircleQuestion, Sparkles } from 'lucide-react';
import type { MatchExplanation } from '@2k/shared';
import { Badge, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AiFeedback } from './feedback';

function Bar({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted"><span>{label}</span><span>{value === null ? '—' : `${value}%`}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}>
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

/** Transparent, viewer-relative explanation of why a profile was suggested. */
export function MatchExplanationPanel({ profileId }: { profileId: string }) {
  const [data, setData] = React.useState<MatchExplanation | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      setData(await api<MatchExplanation>(`/profiles/${profileId}/explanation`));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the compatibility explanation.');
    }
  }, [profileId]);
  React.useEffect(() => { void load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-6" aria-busy="true">
      <Skeleton className="h-8 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-24 w-full" />
    </div>
  );

  const dims = data.dimensions.filter((d) => d.score !== null);
  const shown = showAll ? dims : dims.slice(0, 5);
  return (
    <section aria-labelledby="why-title" className="space-y-6 rounded-2xl border border-line bg-surface p-6 shadow-soft">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Why you might align</p>
            <h2 id="why-title" className="mt-1 font-serif text-3xl leading-tight">{data.compatibility.label}</h2>
          </div>
          <div className="text-right">
            <p className="font-serif text-4xl text-emerald-600">{data.compatibility.mutual}<span className="text-xl">%</span></p>
            <p className="text-xs text-muted">mutual · {data.compatibility.confidence}% complete info</p>
          </div>
        </div>
        <p className="text-[0.98rem] text-ink-2 text-pretty">{data.headline}</p>
        {data.generator === 'ai' && <Badge tone="gold"><Sparkles aria-hidden />Written with AI from your shared details</Badge>}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Bar label="How they fit what you asked for" value={data.compatibility.forViewer} />
        <Bar label="How you fit what they asked for" value={data.compatibility.forCandidate} />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">By area</h3>
        <ul className="space-y-3">
          {shown.map((d) => (
            <li key={d.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1">
              <span className="text-sm font-medium text-ink">{d.label}</span>
              <span className="text-sm tabular-nums text-ink-2">{d.score}%</span>
              <div className="col-span-2 h-1 overflow-hidden rounded-full bg-line"><div className="h-full bg-gold-400" style={{ width: `${d.score}%` }} /></div>
              <span className="col-span-2 text-xs text-muted">{d.note}</span>
            </li>
          ))}
        </ul>
        {dims.length > 5 && <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm text-emerald-600 hover:underline">{showAll ? 'Show fewer areas' : `Show all ${dims.length} areas`}</button>}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {data.alignments.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Where you align</h3>
            <ul className="space-y-1.5 text-sm text-ink-2">{data.alignments.map((a) => <li key={a} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />{a}</li>)}</ul>
          </div>
        )}
        {data.differences.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Worth discussing</h3>
            <ul className="space-y-1.5 text-sm text-ink-2">{data.differences.map((a) => <li key={a} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" aria-hidden />{a}</li>)}</ul>
          </div>
        )}
      </div>

      {data.sharedInterests.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Shared interests</h3>
          <div className="flex flex-wrap gap-2">{data.sharedInterests.map((i) => <Badge key={i} tone="outline">{i}</Badge>)}</div>
        </div>
      )}

      {(data.mutualPreferenceNotes.length > 0 || data.missingInformation.length > 0) && (
        <div className="space-y-1 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
          {data.mutualPreferenceNotes.map((n) => <p key={n}>{n}</p>)}
          {data.missingInformation.length > 0 && <p className="text-muted">Not enough information yet about: {data.missingInformation.join(', ').toLowerCase()}.</p>}
        </div>
      )}

      {data.conversationStarters.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><MessageCircleQuestion className="h-4 w-4 text-gold-600" aria-hidden />Conversation starters</h3>
          <ul className="space-y-2">{data.conversationStarters.map((s) => <li key={s} className={cn('rounded-xl border border-line px-4 py-2.5 text-sm text-ink-2')}>{s}</li>)}</ul>
        </div>
      )}

      <footer className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted text-pretty">{data.disclaimer}</p>
        <AiFeedback feature="match_explanation" referenceId={profileId} className="shrink-0" />
      </footer>
    </section>
  );
}
