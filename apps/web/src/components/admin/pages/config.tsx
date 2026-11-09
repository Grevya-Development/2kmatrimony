'use client';
import * as React from 'react';
import { Plus } from 'lucide-react';
import { Badge, Button, Dialog, DialogContent, Field, Input, NativeSelect, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui';
import { AdminHeader, DataTable, ErrorOr, JsonEditor, Panel, fmtDateTime, human, mutate, useAdminData, useCan } from '../kit';

interface Flag { key: string; description: string; enabled: boolean; rollout_percent: number; updated_at: string }
interface Setting { key: string; value: Record<string, unknown>; description: string | null; is_public: boolean; validated: boolean; updated_at: string }
interface Region { code: string; name: string; country_code: string; is_enabled: boolean; matching_config_region: string }
interface Language { code: string; name: string; native_name: string; is_enabled: boolean; ai_supported: boolean }
interface Question { id: string; key: string; section: string; prompt: string; help_text: string | null; input_type: string; options: unknown; maps_to: string | null; is_required: boolean; is_active: boolean; sort_order: number; translations: Record<string, unknown> }

export function ConfigPage() {
  const can = useCan();
  const tabs = [
    can('feature_flags.manage') && ['flags', 'Feature flags'],
    can('settings.manage') && ['settings', 'Platform settings'],
    can('regions.manage') && ['regions', 'Regions & languages'],
    can('onboarding.manage') && ['questions', 'Onboarding questions'],
  ].filter(Boolean) as [string, string][];
  if (tabs.length === 0) return <AdminHeader title="Configuration" description="You do not have permission to change platform configuration." />;
  return (
    <>
      <AdminHeader title="Configuration" description="Every change is audited and takes effect within about 30 seconds." />
      <Tabs defaultValue={tabs[0]![0]}>
        <TabsList className="flex-wrap">{tabs.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList>
        {can('feature_flags.manage') && <TabsContent value="flags"><Flags /></TabsContent>}
        {can('settings.manage') && <TabsContent value="settings"><Settings /></TabsContent>}
        {can('regions.manage') && <TabsContent value="regions"><Regions /></TabsContent>}
        {can('onboarding.manage') && <TabsContent value="questions"><Questions /></TabsContent>}
      </Tabs>
    </>
  );
}

function Flags() {
  const state = useAdminData<Flag[]>('/admin/flags');
  const update = async (key: string, body: Record<string, unknown>, msg: string) => {
    if (await mutate(`/admin/flags/${key}`, 'PATCH', body, msg)) state.reload();
  };
  return (
    <Panel>
      <ErrorOr state={state}>
        {(flags) => (
          <ul className="divide-y divide-line">
            {flags.map((f) => (
              <li key={f.key} className="flex flex-wrap items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm text-ink">{f.key}</p>
                  <p className="text-sm text-muted">{f.description}</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted">Rollout
                  <Input type="number" min={0} max={100} defaultValue={f.rollout_percent} aria-label={`Rollout percent for ${f.key}`} className="h-8 w-20 text-sm"
                    onBlur={(e) => { const v = Number(e.target.value); if (v !== f.rollout_percent && v >= 0 && v <= 100) update(f.key, { rolloutPercent: v }, 'Rollout updated'); }} />%
                </label>
                <Switch checked={f.enabled} onCheckedChange={(enabled) => update(f.key, { enabled }, `${f.key} ${enabled ? 'enabled' : 'disabled'}`)} aria-label={`Toggle ${f.key}`} />
              </li>
            ))}
          </ul>
        )}
      </ErrorOr>
    </Panel>
  );
}

function Settings() {
  const state = useAdminData<Setting[]>('/admin/settings');
  const [editing, setEditing] = React.useState<{ key: string; json: string; isPublic: boolean } | null>(null);
  return (
    <Panel>
      <ErrorOr state={state}>
        {(rows) => (
          <DataTable<Setting> caption="Platform settings" rows={rows} rowKey={(s) => s.key} onRowClick={(s) => setEditing({ key: s.key, json: JSON.stringify(s.value, null, 2), isPublic: s.is_public })}
            columns={[
              { key: 'key', label: 'Key', render: (s) => <span className="font-mono text-sm text-ink">{s.key}</span> },
              { key: 'description', label: 'Description', render: (s) => s.description ?? '—' },
              { key: 'public', label: 'Visibility', render: (s) => <Badge tone={s.is_public ? 'info' : 'outline'}>{s.is_public ? 'Public' : 'Server only'}</Badge> },
              { key: 'validated', label: 'Schema', render: (s) => (s.validated ? 'Validated' : 'Free-form'), hideOnMobile: true },
              { key: 'updated', label: 'Updated', render: (s) => fmtDateTime(s.updated_at), hideOnMobile: true },
            ]} />
        )}
      </ErrorOr>
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent title={`Edit ${editing.key}`} description="Known keys are validated before saving." className="max-w-xl">
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              let value: unknown;
              try { value = JSON.parse(editing.json); } catch { return; }
              if (await mutate(`/admin/settings/${editing.key}`, 'PUT', { value, isPublic: editing.isPublic }, 'Setting saved')) { setEditing(null); state.reload(); }
            }}>
              <JsonEditor id="setting-json" label="Value (JSON object)" value={editing.json} onChange={(json) => setEditing({ ...editing, json })} rows={14} />
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.isPublic} onCheckedChange={(isPublic) => setEditing({ ...editing, isPublic })} aria-label="Public" />Expose to apps via /api/v1/config</label>
              <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit">Save</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Panel>
  );
}

function Regions() {
  const state = useAdminData<{ regions: Region[]; languages: Language[] }>('/admin/regions');
  return (
    <ErrorOr state={state}>
      {({ regions, languages }) => (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Languages" description="Enabled languages appear in the apps. AI features understand all supported languages.">
            <ul className="divide-y divide-line">
              {languages.map((l) => (
                <li key={l.code} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span><span className="text-ink">{l.name}</span> <span className="text-muted">{l.native_name}</span></span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-muted">AI<Switch checked={l.ai_supported} onCheckedChange={async (aiSupported) => { if (await mutate(`/admin/languages/${l.code}`, 'PATCH', { aiSupported }, 'Saved')) state.reload(); }} aria-label={`AI support for ${l.name}`} /></label>
                    <label className="flex items-center gap-2 text-xs text-muted">Enabled<Switch checked={l.is_enabled} disabled={l.code === 'en'} onCheckedChange={async (isEnabled) => { if (await mutate(`/admin/languages/${l.code}`, 'PATCH', { isEnabled }, 'Saved')) state.reload(); }} aria-label={`Enable ${l.name}`} /></label>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Regions" description="Regional availability and which matching configuration applies.">
            <ul className="divide-y divide-line">
              {regions.map((r) => (
                <li key={r.code} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span><span className="font-mono text-xs">{r.code}</span> <span className="text-ink">{r.name}</span></span>
                  <div className="flex items-center gap-3">
                    <Input aria-label={`Matching config region for ${r.name}`} defaultValue={r.matching_config_region} className="h-8 w-28 text-xs" onBlur={async (e) => { if (e.target.value && e.target.value !== r.matching_config_region && (await mutate(`/admin/regions/${r.code}`, 'PATCH', { matchingConfigRegion: e.target.value }, 'Saved'))) state.reload(); }} />
                    <Switch checked={r.is_enabled} onCheckedChange={async (isEnabled) => { if (await mutate(`/admin/regions/${r.code}`, 'PATCH', { isEnabled }, 'Saved')) state.reload(); }} aria-label={`Enable ${r.name}`} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </ErrorOr>
  );
}

const SECTIONS = ['basics', 'education', 'career', 'family', 'lifestyle', 'values', 'dna', 'preferences'];
const TYPES = ['single_select', 'multi_select', 'text', 'long_text', 'number', 'scale', 'date', 'tags'];
const blankQ = { key: '', section: 'values', prompt: '', helpText: '', inputType: 'single_select', options: '[\n  { "value": "a", "label": "Option A" },\n  { "value": "b", "label": "Option B" }\n]', mapsTo: '', isRequired: false, isActive: true, sortOrder: 0, translations: '{}' };

function Questions() {
  const state = useAdminData<Question[]>('/admin/questions');
  const [editing, setEditing] = React.useState<(typeof blankQ & { id?: string }) | null>(null);
  return (
    <Panel actions={<Button size="sm" onClick={() => setEditing({ ...blankQ })}><Plus />New question</Button>} description="Conversational questions asked during onboarding. Keys are permanent because saved answers reference them.">
      <ErrorOr state={state}>
        {(rows) => (
          <DataTable<Question> caption="Onboarding questions" rows={rows}
            onRowClick={(q) => setEditing({ id: q.id, key: q.key, section: q.section, prompt: q.prompt, helpText: q.help_text ?? '', inputType: q.input_type, options: JSON.stringify(q.options, null, 2), mapsTo: q.maps_to ?? '', isRequired: q.is_required, isActive: q.is_active, sortOrder: q.sort_order, translations: JSON.stringify(q.translations ?? {}, null, 2) })}
            columns={[
              { key: 'prompt', label: 'Question', render: (q) => <span className="text-ink">{q.prompt}</span> },
              { key: 'section', label: 'Section', render: (q) => <span className="capitalize">{q.section}</span> },
              { key: 'type', label: 'Type', render: (q) => human(q.input_type), hideOnMobile: true },
              { key: 'order', label: 'Order', render: (q) => q.sort_order, hideOnMobile: true },
              { key: 'status', label: 'Status', render: (q) => <span className="inline-flex gap-1"><Badge tone={q.is_active ? 'success' : 'outline'}>{q.is_active ? 'Active' : 'Inactive'}</Badge>{q.is_required && <Badge tone="info">Required</Badge>}</span> },
            ]} />
        )}
      </ErrorOr>
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent side="right" title={editing.id ? 'Edit question' : 'New question'} className="max-w-2xl">
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              let options: unknown; let translations: unknown;
              try { options = JSON.parse(editing.options); translations = JSON.parse(editing.translations); } catch { return; }
              const body = { ...(editing.id ? {} : { key: editing.key }), section: editing.section, prompt: editing.prompt, helpText: editing.helpText || null, inputType: editing.inputType, options, mapsTo: editing.mapsTo || null, isRequired: editing.isRequired, isActive: editing.isActive, sortOrder: Number(editing.sortOrder), translations };
              const r = editing.id ? await mutate(`/admin/questions/${editing.id}`, 'PATCH', body, 'Question saved') : await mutate('/admin/questions', 'POST', body, 'Question created');
              if (r) { setEditing(null); state.reload(); }
            }}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Key" htmlFor="q-key"><Input value={editing.key} disabled={!!editing.id} onChange={(e) => setEditing({ ...editing, key: e.target.value })} className="font-mono text-sm" required /></Field>
                <Field label="Section" htmlFor="q-section"><NativeSelect value={editing.section} onChange={(e) => setEditing({ ...editing, section: e.target.value })}>{SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</NativeSelect></Field>
                <Field label="Input type" htmlFor="q-type"><NativeSelect value={editing.inputType} onChange={(e) => setEditing({ ...editing, inputType: e.target.value, options: e.target.value === 'scale' ? '{\n  "left": "",\n  "right": ""\n}' : editing.options })}>{TYPES.map((t) => <option key={t} value={t}>{human(t)}</option>)}</NativeSelect></Field>
                <Field label="Maps to" htmlFor="q-maps" hint="e.g. dna:communication or profile_values.conflict_style" optional><Input value={editing.mapsTo} onChange={(e) => setEditing({ ...editing, mapsTo: e.target.value })} className="font-mono text-xs" /></Field>
              </div>
              <Field label="Question" htmlFor="q-prompt"><Input value={editing.prompt} onChange={(e) => setEditing({ ...editing, prompt: e.target.value })} required /></Field>
              <Field label="Help text" htmlFor="q-help" optional><Textarea value={editing.helpText} onChange={(e) => setEditing({ ...editing, helpText: e.target.value })} className="min-h-16" /></Field>
              <JsonEditor id="q-options" label={editing.inputType === 'scale' ? 'Scale labels {left, right}' : 'Options [{value, label}]'} value={editing.options} onChange={(options) => setEditing({ ...editing, options })} rows={8} />
              <JsonEditor id="q-translations" label='Translations, e.g. {"ta": {"prompt": "…"}}' value={editing.translations} onChange={(translations) => setEditing({ ...editing, translations })} rows={5} />
              <div className="flex flex-wrap items-center gap-6">
                <Field label="Sort order" htmlFor="q-order"><Input type="number" min={0} value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} className="w-28" /></Field>
                <label className="mt-6 flex items-center gap-2 text-sm"><Switch checked={editing.isRequired} onCheckedChange={(isRequired) => setEditing({ ...editing, isRequired })} aria-label="Required" />Required</label>
                <label className="mt-6 flex items-center gap-2 text-sm"><Switch checked={editing.isActive} onCheckedChange={(isActive) => setEditing({ ...editing, isActive })} aria-label="Active" />Active</label>
              </div>
              <div className="flex justify-between">
                {editing.id ? <Button type="button" variant="ghost" className="text-danger" onClick={async () => { if (await mutate(`/admin/questions/${editing.id}`, 'DELETE', undefined, 'Question deactivated')) { setEditing(null); state.reload(); } }}>Deactivate</Button> : <span />}
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Panel>
  );
}
