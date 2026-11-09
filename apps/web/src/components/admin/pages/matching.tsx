'use client';
import * as React from 'react';
import { SCORE_DIMENSIONS, SCORE_DIMENSION_LABELS, type ScoreDimension } from '@2k/shared';
import { Badge, Button, Field, Input, Notice, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui';
import { SimpleBarChart } from '@/components/charts/charts';
import { AdminHeader, ConfirmAction, DataTable, ErrorOr, KeyValues, Panel, RangePicker, StatCard, StatusBadge, fmtDateTime, fmtNum, human, lastDays, mutate, qs, useAdminData, useCan } from '../kit';

interface Stats {
  histogram: { bucket: number; count: number }[]; pairsScored: number; avgMutual: number | null; avgConfidence: number | null;
  recommendations: { total: number; viewed: number; interested: number; shortlisted: number; passed: number; avgScore: number | null };
  interests: { sent: number; accepted: number; declined: number; pending: number; expired: number };
  feedback: { reason: string; positive: number; negative: number; neutral: number }[];
  dimensions: Record<string, number>;
}
interface Config { id: string; version: number; region: string; weights: Record<ScoreDimension, number>; thresholds: Record<string, number>; notes: string | null; is_active: boolean; created_at: string }

const rate = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');

export function MatchingPage() {
  const can = useCan();
  return (
    <>
      <AdminHeader title="Matchmaking intelligence" description="How the mutual engine is performing, and the weights that drive it. Every change creates a new audited version." />
      <Tabs defaultValue="insights">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="weights">Weights & thresholds</TabsTrigger>
          <TabsTrigger value="test">Test a pair</TabsTrigger>
        </TabsList>
        <TabsContent value="insights"><Insights /></TabsContent>
        <TabsContent value="weights"><Weights canEdit={can('matching.configure')} /></TabsContent>
        <TabsContent value="test"><TestPair /></TabsContent>
      </Tabs>
    </>
  );
}

function Insights() {
  const [range, setRange] = React.useState(lastDays(30));
  const state = useAdminData<Stats>(`/admin/matching/stats${qs(range)}`);
  return (
    <div className="space-y-4">
      <RangePicker value={range} onChange={setRange} />
      <ErrorOr state={state}>
        {(s) => (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Pairs scored (all time)" current={s.pairsScored} />
              <StatCard label="Average mutual score" value={s.avgMutual ?? '—'} hint={`confidence ${s.avgConfidence ?? '—'}`} />
              <StatCard label="Recommendation acceptance" value={rate(s.recommendations.interested + s.recommendations.shortlisted, s.recommendations.total)} hint={`${fmtNum(s.recommendations.total)} shown`} />
              <StatCard label="Interest acceptance" value={rate(s.interests.accepted, s.interests.accepted + s.interests.declined)} hint={`${fmtNum(s.interests.sent)} sent`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Mutual score distribution"><SimpleBarChart label="Count of pairs by mutual score bucket" data={s.histogram.map((h) => ({ bucket: `${h.bucket}–${h.bucket + 9}`, count: h.count }))} xKey="bucket" series={[{ key: 'count', label: 'Pairs' }]} /></Panel>
              <Panel title="Average by dimension"><SimpleBarChart layout="vertical" label="Average mutual score per dimension" data={SCORE_DIMENSIONS.map((d) => ({ dimension: SCORE_DIMENSION_LABELS[d], score: s.dimensions[d] ?? 0 }))} xKey="dimension" series={[{ key: 'score', label: 'Average' }]} height={280} /></Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Recommendation outcomes">
                <KeyValues items={[['Shown', fmtNum(s.recommendations.total)], ['Viewed', `${fmtNum(s.recommendations.viewed)} (${rate(s.recommendations.viewed, s.recommendations.total)})`], ['Interested', fmtNum(s.recommendations.interested)], ['Shortlisted', fmtNum(s.recommendations.shortlisted)], ['Passed', fmtNum(s.recommendations.passed)], ['Average score', s.recommendations.avgScore ?? '—']]} />
              </Panel>
              <Panel title="Member feedback on matches">
                <DataTable caption="Match feedback by reason" rows={s.feedback.map((f) => ({ ...f, id: f.reason }))} empty="No feedback in this period."
                  columns={[{ key: 'reason', label: 'Reason', render: (f) => <span className="capitalize">{human(f.reason)}</span> }, { key: 'positive', label: '👍' }, { key: 'neutral', label: 'Neutral' }, { key: 'negative', label: '👎' }]} />
              </Panel>
            </div>
          </>
        )}
      </ErrorOr>
    </div>
  );
}

const THRESHOLD_LABELS: Record<string, string> = {
  min_recommend_mutual: 'Minimum mutual score to recommend', min_direction: 'Minimum score in each direction', max_asymmetry: 'Maximum gap between directions',
  min_confidence: 'Minimum confidence', daily_batch_size: 'Daily recommendations (cap)', candidate_pool: 'Candidate pool size',
};

function Weights({ canEdit }: { canEdit: boolean }) {
  const state = useAdminData<Config[]>('/admin/matching/configs');
  const [draft, setDraft] = React.useState<{ weights: Record<string, number>; thresholds: Record<string, number>; notes: string } | null>(null);
  const active = state.data?.find((c) => c.is_active);
  React.useEffect(() => {
    if (active && !draft) setDraft({ weights: { ...active.weights }, thresholds: { min_recommend_mutual: 55, min_direction: 45, max_asymmetry: 30, min_confidence: 30, daily_batch_size: 12, candidate_pool: 400, ...active.thresholds }, notes: '' });
  }, [active, draft]);
  const total = draft ? Object.values(draft.weights).reduce((a, b) => a + (Number(b) || 0), 0) : 0;
  return (
    <ErrorOr state={state}>
      {(configs) => (
        <div className="grid gap-4 lg:grid-cols-5">
          <Panel title={`Edit weights${active ? ` (based on v${active.version})` : ''}`} className="lg:col-span-3">
            {draft && (
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-3">
                  {SCORE_DIMENSIONS.map((d) => {
                    const w = Number(draft.weights[d]) || 0;
                    return (
                      <div key={d} className="grid grid-cols-[1fr_5rem_4rem] items-center gap-3">
                        <label htmlFor={`w-${d}`} className="text-sm text-ink-2">{SCORE_DIMENSION_LABELS[d]}</label>
                        <Input id={`w-${d}`} type="number" min={0} max={100} disabled={!canEdit} value={draft.weights[d] ?? 0} onChange={(e) => setDraft({ ...draft, weights: { ...draft.weights, [d]: Number(e.target.value) } })} className="h-9 text-sm" />
                        <span className="text-right text-xs text-muted" aria-label={`Normalised share for ${SCORE_DIMENSION_LABELS[d]}`}>{total ? `${((w / total) * 100).toFixed(1)}%` : '—'}</span>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted">Weights are normalised automatically — the right column shows each dimension’s effective share (total {total}).</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.keys(THRESHOLD_LABELS).map((k) => (
                    <Field key={k} label={THRESHOLD_LABELS[k]!} htmlFor={`t-${k}`}>
                      <Input type="number" disabled={!canEdit} value={draft.thresholds[k] ?? 0} onChange={(e) => setDraft({ ...draft, thresholds: { ...draft.thresholds, [k]: Number(e.target.value) } })} className="h-10 text-sm" />
                    </Field>
                  ))}
                </div>
                {canEdit && (
                  <>
                    <Field label="Why are you changing this?" htmlFor="cfg-notes" hint="Saved with the version for future reference."><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="min-h-20" /></Field>
                    <Notice tone="warning">Publishing changes today’s and future recommendations for every member. Test with “Test a pair” first.</Notice>
                    <Button disabled={draft.notes.trim().length < 3 || total <= 0} onClick={async () => {
                      const r = await mutate('/admin/matching/configs', 'POST', { region: 'default', weights: draft.weights, thresholds: draft.thresholds, notes: draft.notes.trim(), activate: true }, 'New version published');
                      if (r) { setDraft(null); state.reload(); }
                    }}>Publish new version</Button>
                  </>
                )}
              </form>
            )}
          </Panel>
          <Panel title="Version history" className="lg:col-span-2">
            <ul className="space-y-3">
              {configs.map((c) => (
                <li key={c.id} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">v{c.version}</span>
                    {c.is_active ? <Badge tone="success">Active</Badge> : canEdit && (
                      <ConfirmAction trigger={<Button size="sm" variant="ghost">Roll back</Button>} title={`Activate v${c.version}?`} description="This replaces the active weights for all members." confirmLabel="Activate"
                        onConfirm={() => mutate(`/admin/matching/configs/${c.id}/activate`, 'POST', undefined, `v${c.version} is active`).then((r) => { if (r) { setDraft(null); state.reload(); } return r; })} />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">{fmtDateTime(c.created_at)}</p>
                  {c.notes && <p className="mt-1 text-ink-2">{c.notes}</p>}
                  <p className="mt-1 text-xs text-muted">{SCORE_DIMENSIONS.map((d) => `${d.slice(0, 4)} ${c.weights[d]}`).join(' · ')}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </ErrorOr>
  );
}

interface PairResult {
  mutual: number; confidence: number; eligible: boolean; recommended: boolean; configVersion: number;
  a: { code: string }; b: { code: string };
  dimensions: Record<string, { mutual: number | null; aToB: number | null; bToA: number | null }>;
  aToB: { score: number; confidence: number; dealbreakers: { label: string }[]; missing: string[]; checks: { label: string; status: string; hard: boolean }[] };
  bToA: { score: number; confidence: number; dealbreakers: { label: string }[]; missing: string[]; checks: { label: string; status: string; hard: boolean }[] };
  explanationForA: { headline: string; alignments: string[]; differences: string[] };
}

function TestPair() {
  const [codes, setCodes] = React.useState({ codeA: '', codeB: '' });
  const [res, setRes] = React.useState<PairResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="space-y-4">
      <Panel title="Compare two profiles" description="Runs the active engine configuration in both directions. Nothing is saved or shown to members.">
        <form className="flex flex-wrap items-end gap-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setRes(await mutate<PairResult>('/admin/matching/test', 'POST', codes)); setBusy(false); }}>
          <Field label="Profile A" htmlFor="pair-a"><Input value={codes.codeA} onChange={(e) => setCodes({ ...codes, codeA: e.target.value })} placeholder="TK100001" className="h-10 w-40" /></Field>
          <Field label="Profile B" htmlFor="pair-b"><Input value={codes.codeB} onChange={(e) => setCodes({ ...codes, codeB: e.target.value })} placeholder="TK100002" className="h-10 w-40" /></Field>
          <Button type="submit" loading={busy} disabled={!codes.codeA || !codes.codeB}>Compare</Button>
        </form>
      </Panel>
      {res && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Mutual" value={res.mutual} hint={`config v${res.configVersion}`} />
            <StatCard label={`${res.b.code} fits ${res.a.code}`} value={res.aToB.score} hint={`confidence ${res.aToB.confidence}`} />
            <StatCard label={`${res.a.code} fits ${res.b.code}`} value={res.bToA.score} hint={`confidence ${res.bToA.confidence}`} />
            <StatCard label="Recommendable" value={res.recommended ? 'Yes' : 'No'} hint={res.eligible ? 'No dealbreakers' : 'Dealbreaker present'} />
          </div>
          <Panel title="Dimensions">
            <DataTable caption="Dimension breakdown" rows={SCORE_DIMENSIONS.map((d) => ({ id: d, ...res.dimensions[d]! }))}
              columns={[{ key: 'id', label: 'Dimension', render: (r) => SCORE_DIMENSION_LABELS[r.id as ScoreDimension] }, { key: 'mutual', label: 'Mutual', render: (r) => r.mutual ?? '—' }, { key: 'aToB', label: `For ${res.a.code}`, render: (r) => r.aToB ?? '—' }, { key: 'bToA', label: `For ${res.b.code}`, render: (r) => r.bToA ?? '—' }]} />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            {([['aToB', `${res.a.code}’s preferences`], ['bToA', `${res.b.code}’s preferences`]] as const).map(([k, title]) => (
              <Panel key={k} title={title}>
                <ul className="space-y-1 text-sm">{res[k].checks.map((c, i) => <li key={i} className="flex justify-between gap-2"><span>{c.label}{c.hard && <Badge tone="outline" className="ml-2">Non-negotiable</Badge>}</span><StatusBadge status={c.status === 'met' ? 'approved' : c.status === 'unmet' ? 'rejected' : 'pending'} /></li>)}</ul>
                {res[k].missing.length > 0 && <p className="mt-3 text-xs text-muted">Missing: {res[k].missing.join(', ')}</p>}
              </Panel>
            ))}
          </div>
          <Panel title="Explanation (as seen by A)">
            <p className="font-medium">{res.explanationForA.headline}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 text-sm">
              <ul className="list-disc space-y-1 pl-5">{res.explanationForA.alignments.map((a) => <li key={a}>{a}</li>)}</ul>
              <ul className="list-disc space-y-1 pl-5 text-ink-2">{res.explanationForA.differences.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
