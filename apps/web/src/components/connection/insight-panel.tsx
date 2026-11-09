'use client';
import * as React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { BeforeYouMeetBriefing, GapAnalysis, InsightEnvelope } from '@2k/shared';
import { relativeTime } from '@2k/shared';
import { AiFeedback } from '@/components/ai/feedback';
import { Badge, Button, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';

type Kind = 'gap_analysis' | 'before_you_meet';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-2"><h3 className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</h3>{children}</div>;
}
const List = ({ items }: { items: string[] }) => <ul className="space-y-1.5 text-[0.95rem] text-ink-2">{items.map((i) => <li key={i} className="flex gap-2"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-champagne-400" aria-hidden />{i}</li>)}</ul>;

function GapView({ c }: { c: GapAnalysis }) {
  return (
    <div className="space-y-8">
      {c.alignments.length > 0 && (
        <Section title="Areas of alignment">
          <div className="grid gap-3 sm:grid-cols-2">{c.alignments.map((a) => <div key={a.topic + a.detail} className="rounded-xl bg-success-bg/60 p-4"><p className="font-medium text-ink">{a.topic}</p><p className="text-sm text-ink-2">{a.detail}</p></div>)}</div>
        </Section>
      )}
      <Section title="Potential differences">
        {c.differences.length === 0 ? <p className="text-sm text-muted">No notable differences in what you’ve both shared so far.</p> : (
          <div className="space-y-3">{c.differences.map((d) => (
            <div key={d.topic + d.detail} className="rounded-xl border border-line p-4">
              <p className="font-medium text-ink">{d.topic}</p>
              <p className="text-sm text-ink-2">{d.detail}</p>
              {d.possibleCompromises.length > 0 && <div className="mt-3"><p className="text-xs font-semibold text-muted">Possible approaches</p><List items={d.possibleCompromises} /></div>}
            </div>
          ))}</div>
        )}
      </Section>
      {c.unansweredQuestions.length > 0 && <Section title="Not yet answered"><List items={c.unansweredQuestions} /></Section>}
      {c.suggestedConversations.length > 0 && <Section title="Suggested conversations"><List items={c.suggestedConversations} /></Section>}
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">{c.note}</p>
    </div>
  );
}

function BymView({ c }: { c: BeforeYouMeetBriefing }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Shared interests">{c.sharedInterests.length ? <div className="flex flex-wrap gap-2">{c.sharedInterests.map((i) => <Badge key={i} tone="outline">{i}</Badge>)}</div> : <p className="text-sm text-muted">Discover these together — it’s a great first topic.</p>}</Section>
        <Section title="Shared values">{c.sharedValues.length ? <div className="flex flex-wrap gap-2">{c.sharedValues.map((i) => <Badge key={i} tone="champagne">{i}</Badge>)}</div> : <p className="text-sm text-muted">Nothing overlapping yet in what you’ve shared.</p>}</Section>
      </div>
      {c.compatibilityAreas.length > 0 && <Section title="Where you align"><div className="grid gap-3 sm:grid-cols-2">{c.compatibilityAreas.map((a) => <div key={a.area} className="rounded-xl bg-success-bg/60 p-4"><p className="font-medium">{a.area}</p><p className="text-sm text-ink-2">{a.detail}</p></div>)}</div></Section>}
      {c.potentialDifferences.length > 0 && <Section title="Gently worth exploring"><div className="space-y-2">{c.potentialDifferences.map((a) => <div key={a.area} className="rounded-xl border border-line p-4"><p className="font-medium">{a.area}</p><p className="text-sm text-ink-2">{a.detail}</p></div>)}</div></Section>}
      <Section title="Conversation starters"><ol className="space-y-2">{c.conversationStarters.map((s, i) => <li key={s} className="flex gap-3 rounded-xl border border-line px-4 py-2.5 text-[0.95rem]"><span className="font-serif text-lg text-champagne-600">{i + 1}</span>{s}</li>)}</ol></Section>
      <Section title="Before progressing, discuss"><List items={c.questionsToDiscuss} /></Section>
      <Section title="First-meeting ideas"><div className="grid gap-3 sm:grid-cols-3">{c.firstMeetingIdeas.map((m) => <div key={m.idea} className="rounded-xl bg-surface-2 p-4"><p className="font-medium">{m.idea}</p><p className="mt-1 text-sm text-ink-2">{m.why}</p></div>)}</div></Section>
      <p className="rounded-xl bg-info-bg px-4 py-3 text-sm text-info">{c.note}</p>
    </div>
  );
}

export function InsightPanel({ connectionId, kind, entitled, active }: { connectionId: string; kind: Kind; entitled: boolean; active: boolean }) {
  const [env, setEnv] = React.useState<InsightEnvelope<GapAnalysis | BeforeYouMeetBriefing> | null | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const label = kind === 'gap_analysis' ? 'Compatibility Gap Analysis' : 'Before You Meet';

  React.useEffect(() => {
    setEnv(undefined);
    api<InsightEnvelope<GapAnalysis | BeforeYouMeetBriefing> | null>(`/connections/${connectionId}/insights?kind=${kind}`)
      .then(setEnv)
      .catch((e) => { setError(e instanceof ApiClientError ? e.message : 'Could not load.'); setEnv(null); });
  }, [connectionId, kind]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      setEnv(await api(`/connections/${connectionId}/insights?kind=${kind}`, { method: 'POST' }));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not generate.');
    } finally {
      setBusy(false);
    }
  };

  if (env === undefined) return <div className="space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-32 w-full" /></div>;
  const action = entitled
    ? active ? <Button onClick={generate} loading={busy}>{env ? 'Refresh' : `Prepare ${label}`}</Button> : null
    : <Button asChild variant="champagne"><Link href="/app/billing">See plans that include this</Link></Button>;

  return (
    <div className="space-y-6">
      {error && <ErrorState message={error} />}
      {!env ? (
        <EmptyState icon={<Sparkles />} title={label}
          description={kind === 'gap_analysis'
            ? 'An optional, private comparison of where you align, where you differ, and conversations worth having. Both of you can read it.'
            : 'A private briefing before you meet: shared interests, values, thoughtful conversation starters and relaxed first-meeting ideas. Both of you can read it.'}
          action={action} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>Prepared {relativeTime(env.createdAt)}</span>
              {env.generator === 'ai' ? <Badge tone="champagne"><Sparkles aria-hidden />AI-written</Badge> : <Badge>From your shared answers</Badge>}
            </div>
            {action}
          </div>
          {kind === 'gap_analysis' ? <GapView c={env.content as GapAnalysis} /> : <BymView c={env.content as BeforeYouMeetBriefing} />}
          <AiFeedback feature={kind} referenceId={env.id} />
        </>
      )}
    </div>
  );
}
