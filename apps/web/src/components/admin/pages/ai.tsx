'use client';
import * as React from 'react';
import { Badge, Button, Dialog, DialogContent, Field, Input, NativeSelect, Notice, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui';
import { TimeAreaChart } from '@/components/charts/charts';
import { AdminHeader, DataTable, ErrorOr, Panel, RangePicker, StatCard, fmtDateTime, fmtNum, fmtPct, fmtUsd, human, lastDays, mutate, qs, useAdminData, useCan } from '../kit';

interface Usage {
  anthropicConfigured: boolean; voyageConfigured: boolean;
  totals: { requests: number; errors: number; refusals: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; costUsd: number; errorRate: number; refusalRate: number };
  byFeature: { feature: string; provider: string; model: string; requests: number; errors: number; refusals: number; input_tokens: number; output_tokens: number; cache_read_tokens: number; costUsd: number; p50_latency_ms: number | null; p95_latency_ms: number | null }[];
  series: { day: string; requests: number; costUsd: number }[];
  feedback: { feature: string; positive: number; negative: number }[];
  recommendationAcceptance: number | null;
}
interface FeatureConfig { feature: string; provider: string; model: string; effort: string | null; max_tokens: number; prompt_key: string | null; enabled: boolean; daily_user_limit: number | null; updated_at: string }
interface Prompts { safetyPreamble: string; keys: { key: string; codeDefault: string | null; versions: { id: string; version: number; system_prompt: string; notes: string | null; is_active: boolean; created_at: string }[] }[] }

export function AiOpsPage() {
  const can = useCan();
  return (
    <>
      <AdminHeader title="AI operations" description="Model usage, cost, quality and configuration. Changes take effect within a minute and are audited." />
      <Tabs defaultValue="usage">
        <TabsList><TabsTrigger value="usage">Usage & quality</TabsTrigger><TabsTrigger value="models">Models & limits</TabsTrigger><TabsTrigger value="prompts">Prompts</TabsTrigger></TabsList>
        <TabsContent value="usage"><UsageTab /></TabsContent>
        <TabsContent value="models"><ModelsTab canEdit={can('ai.configure')} /></TabsContent>
        <TabsContent value="prompts"><PromptsTab canEdit={can('ai.configure')} /></TabsContent>
      </Tabs>
    </>
  );
}

function UsageTab() {
  const [range, setRange] = React.useState(lastDays(30));
  const state = useAdminData<Usage>(`/admin/ai/usage${qs(range)}`);
  return (
    <div className="space-y-4">
      <RangePicker value={range} onChange={setRange} />
      <ErrorOr state={state}>
        {(u) => (
          <>
            {!u.anthropicConfigured && <Notice tone="warning">ANTHROPIC_API_KEY is not configured — AI features fall back to engine output.</Notice>}
            {!u.voyageConfigured && <Notice>VOYAGE_API_KEY is not configured — search uses Postgres full-text only.</Notice>}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Requests" current={u.totals.requests} />
              <StatCard label="Spend" value={fmtUsd(u.totals.costUsd)} hint="Anthropic list prices" />
              <StatCard label="Tokens in / out" value={`${fmtNum(u.totals.inputTokens)} / ${fmtNum(u.totals.outputTokens)}`} hint={`${fmtNum(u.totals.cacheReadTokens)} cached reads`} />
              <StatCard label="Errors · refusals" value={`${fmtPct(u.totals.errorRate)} · ${fmtPct(u.totals.refusalRate)}`} hint={u.recommendationAcceptance !== null ? `Rec. acceptance ${fmtPct(u.recommendationAcceptance)}` : undefined} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Requests per day"><TimeAreaChart label="AI requests per day" data={u.series} series={[{ key: 'requests', label: 'Requests' }]} /></Panel>
              <Panel title="Spend per day (USD)"><TimeAreaChart label="AI spend per day" data={u.series} series={[{ key: 'costUsd', label: 'Spend' }]} format={fmtUsd} /></Panel>
            </div>
            <Panel title="By feature and model">
              <DataTable caption="AI usage by feature" rows={u.byFeature.map((r) => ({ ...r, id: `${r.feature}-${r.model}` }))} empty="No AI calls in this period."
                columns={[
                  { key: 'feature', label: 'Feature', render: (r) => <span className="text-ink">{human(r.feature)}</span> },
                  { key: 'model', label: 'Model', render: (r) => <span className="font-mono text-xs">{r.model}</span>, hideOnMobile: true },
                  { key: 'requests', label: 'Requests', render: (r) => fmtNum(Number(r.requests)) },
                  { key: 'err', label: 'Errors', render: (r) => fmtNum(Number(r.errors) + Number(r.refusals)) },
                  { key: 'tokens', label: 'Tokens (in/out)', render: (r) => `${fmtNum(Number(r.input_tokens))} / ${fmtNum(Number(r.output_tokens))}`, hideOnMobile: true },
                  { key: 'latency', label: 'p50 / p95', render: (r) => `${r.p50_latency_ms ?? '—'} / ${r.p95_latency_ms ?? '—'} ms` },
                  { key: 'cost', label: 'Cost', render: (r) => fmtUsd(r.costUsd) },
                ]} />
            </Panel>
            <Panel title="Member feedback">
              <DataTable caption="AI feedback by feature" rows={u.feedback.map((f) => ({ ...f, id: f.feature }))} empty="No feedback yet."
                columns={[{ key: 'feature', label: 'Feature', render: (f) => human(f.feature) }, { key: 'positive', label: 'Helpful' }, { key: 'negative', label: 'Not helpful' }, { key: 'rate', label: 'Helpful rate', render: (f) => fmtPct(f.positive / Math.max(1, f.positive + f.negative)) }]} />
            </Panel>
          </>
        )}
      </ErrorOr>
    </div>
  );
}

function ModelsTab({ canEdit }: { canEdit: boolean }) {
  const state = useAdminData<FeatureConfig[]>('/admin/ai/configs');
  const [editing, setEditing] = React.useState<FeatureConfig | null>(null);
  return (
    <Panel>
      <ErrorOr state={state}>
        {(rows) => (
          <DataTable<FeatureConfig> caption="AI feature configuration" rows={rows} rowKey={(r) => r.feature} onRowClick={canEdit ? setEditing : undefined}
            columns={[
              { key: 'feature', label: 'Feature', render: (r) => <span className="text-ink">{human(r.feature)}</span> },
              { key: 'provider', label: 'Provider', render: (r) => r.provider },
              { key: 'model', label: 'Model', render: (r) => <span className="font-mono text-xs">{r.model}</span> },
              { key: 'effort', label: 'Effort', render: (r) => r.effort ?? '—', hideOnMobile: true },
              { key: 'max', label: 'Max tokens', render: (r) => fmtNum(r.max_tokens), hideOnMobile: true },
              { key: 'limit', label: 'Daily limit', render: (r) => r.daily_user_limit ?? 'Plan-based', hideOnMobile: true },
              { key: 'enabled', label: 'Enabled', render: (r) => <Badge tone={r.enabled ? 'success' : 'outline'}>{r.enabled ? 'On' : 'Off'}</Badge> },
            ]} />
        )}
      </ErrorOr>
      {editing && <EditFeature cfg={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); state.reload(); }} />}
    </Panel>
  );
}

function EditFeature({ cfg, onClose, onSaved }: { cfg: FeatureConfig; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = React.useState({ provider: cfg.provider, model: cfg.model, effort: cfg.effort ?? '', maxTokens: cfg.max_tokens, enabled: cfg.enabled, dailyUserLimit: cfg.daily_user_limit === null ? '' : String(cfg.daily_user_limit) });
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={human(cfg.feature)} description="Use exact model ids, e.g. claude-opus-5-5, claude-sonnet-5-5 or claude-haiku-5-5.">
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          const r = await mutate(`/admin/ai/configs/${cfg.feature}`, 'PATCH', { provider: f.provider, model: f.model.trim(), effort: f.effort || null, maxTokens: f.maxTokens, enabled: f.enabled, dailyUserLimit: f.dailyUserLimit === '' ? null : Number(f.dailyUserLimit) }, 'Configuration saved');
          setBusy(false); if (r) onSaved();
        }}>
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-ink-2">Enabled</span><Switch checked={f.enabled} onCheckedChange={(enabled) => setF({ ...f, enabled })} aria-label="Enabled" /></div>
          <Field label="Provider" htmlFor="ai-provider"><NativeSelect value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}>{(cfg.feature === 'embeddings' ? ['voyage', 'disabled'] : ['anthropic', 'disabled']).map((p) => <option key={p} value={p}>{p}</option>)}</NativeSelect></Field>
          <Field label="Model" htmlFor="ai-model"><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} className="font-mono text-sm" /></Field>
          {cfg.feature !== 'embeddings' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Effort" htmlFor="ai-effort"><NativeSelect value={f.effort} onChange={(e) => setF({ ...f, effort: e.target.value })}><option value="">Model default</option>{['low', 'medium', 'high', 'xhigh', 'max'].map((x) => <option key={x} value={x}>{x}</option>)}</NativeSelect></Field>
              <Field label="Max output tokens" htmlFor="ai-max"><Input type="number" min={256} max={128000} value={f.maxTokens} onChange={(e) => setF({ ...f, maxTokens: Number(e.target.value) })} /></Field>
            </div>
          )}
          <Field label="Per-member daily limit" htmlFor="ai-limit" hint="Empty = use plan entitlements only." optional><Input type="number" min={0} value={f.dailyUserLimit} onChange={(e) => setF({ ...f, dailyUserLimit: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PromptsTab({ canEdit }: { canEdit: boolean }) {
  const state = useAdminData<Prompts>('/admin/ai/prompts');
  const [selected, setSelected] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState({ text: '', notes: '', activate: true });
  return (
    <ErrorOr state={state}>
      {(p) => {
        const current = p.keys.find((k) => k.key === selected) ?? p.keys[0];
        return (
          <div className="grid gap-4 lg:grid-cols-4">
            <Panel title="Prompt keys" className="lg:col-span-1">
              <ul className="space-y-1">
                {p.keys.map((k) => (
                  <li key={k.key}>
                    <button type="button" onClick={() => { setSelected(k.key); setDraft({ text: k.versions.find((v) => v.is_active)?.system_prompt ?? k.codeDefault ?? '', notes: '', activate: true }); }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${current?.key === k.key ? 'bg-ink text-canvas' : 'hover:bg-surface-2'}`}>
                      {k.key}{k.versions.some((v) => v.is_active) && <span className="ml-1 text-xs opacity-70">· override</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
            {current && (
              <div className="space-y-4 lg:col-span-3">
                <Panel title="Always prepended safety rules" description="Defined in code; cannot be overridden from the admin panel.">
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-ink-2">{p.safetyPreamble}</pre>
                </Panel>
                <Panel title={`${current.key} — versions`}>
                  <ul className="space-y-3">
                    <li className="rounded-xl border border-line p-3 text-sm">
                      <div className="flex items-center justify-between"><span className="font-medium">Code default</span>{!current.versions.some((v) => v.is_active) && <Badge tone="success">In use</Badge>}</div>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-ink-2">{current.codeDefault ?? 'Registered by the feature module at runtime (not loaded in this server process yet).'}</pre>
                    </li>
                    {current.versions.map((v) => (
                      <li key={v.id} className="rounded-xl border border-line p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">v{v.version} <span className="font-normal text-muted">· {fmtDateTime(v.created_at)}</span></span>
                          {canEdit && <Button size="sm" variant={v.is_active ? 'secondary' : 'ghost'} onClick={async () => { if (await mutate(`/admin/ai/prompts/${v.id}`, 'PATCH', { isActive: !v.is_active }, v.is_active ? 'Reverted to default' : `v${v.version} active`)) state.reload(); }}>{v.is_active ? 'Deactivate' : 'Activate'}</Button>}
                        </div>
                        {v.notes && <p className="mt-1 text-muted">{v.notes}</p>}
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-ink-2">{v.system_prompt}</pre>
                      </li>
                    ))}
                  </ul>
                </Panel>
                {canEdit && (
                  <Panel title="New version">
                    <form className="space-y-3" onSubmit={async (e) => {
                      e.preventDefault();
                      if (await mutate('/admin/ai/prompts', 'POST', { key: current.key, systemPrompt: draft.text, notes: draft.notes || undefined, activate: draft.activate }, 'Prompt version saved')) { setDraft({ text: '', notes: '', activate: true }); state.reload(); }
                    }}>
                      <Field label="System prompt (feature instructions)" htmlFor="prompt-text"><Textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} className="min-h-56 font-mono text-xs" /></Field>
                      <Field label="Change notes" htmlFor="prompt-notes" optional><Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.activate} onChange={(e) => setDraft({ ...draft, activate: e.target.checked })} className="h-4 w-4 accent-emerald-600" />Activate immediately</label>
                      <Button type="submit" disabled={draft.text.trim().length < 20}>Save version</Button>
                    </form>
                  </Panel>
                )}
              </div>
            )}
          </div>
        );
      }}
    </ErrorOr>
  );
}
