'use client';
import * as React from 'react';
import { Plus, Send } from 'lucide-react';
import { Badge, Button, Dialog, DialogContent, Field, Input, NativeSelect, Notice, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui';
import { AdminHeader, ConfirmAction, DataTable, ErrorOr, Panel, fmtDate, fmtNum, human, mutate, useAdminData } from '../kit';

interface Template { id: string; key: string; channel: string; locale: string; subject: string | null; body: string; provider_template_id: string | null; is_active: boolean; updated_at: string; variables: string[] }
const blank = { key: '', channel: 'in_app', locale: 'en', subject: '', body: '', providerTemplateId: '', isActive: true };

export function NotificationsAdminPage() {
  return (
    <>
      <AdminHeader title="Notifications" description="Templates for every channel and in-app announcements to members." />
      <Tabs defaultValue="templates">
        <TabsList><TabsTrigger value="templates">Templates</TabsTrigger><TabsTrigger value="broadcast">Broadcast</TabsTrigger></TabsList>
        <TabsContent value="templates"><Templates /></TabsContent>
        <TabsContent value="broadcast"><Broadcast /></TabsContent>
      </Tabs>
    </>
  );
}

function Templates() {
  const state = useAdminData<Template[]>('/admin/notifications/templates');
  const [editing, setEditing] = React.useState<(typeof blank & { id?: string }) | null>(null);
  return (
    <Panel actions={<Button size="sm" onClick={() => setEditing({ ...blank })}><Plus />New template</Button>}>
      <ErrorOr state={state}>
        {(rows) => (
          <DataTable<Template> caption="Notification templates" rows={rows}
            onRowClick={(t) => setEditing({ id: t.id, key: t.key, channel: t.channel, locale: t.locale, subject: t.subject ?? '', body: t.body, providerTemplateId: t.provider_template_id ?? '', isActive: t.is_active })}
            columns={[
              { key: 'key', label: 'Key', render: (t) => <span className="font-mono text-xs text-ink">{t.key}</span> },
              { key: 'channel', label: 'Channel', render: (t) => human(t.channel) },
              { key: 'locale', label: 'Lang', render: (t) => t.locale.toUpperCase() },
              { key: 'vars', label: 'Variables', render: (t) => <span className="text-xs">{t.variables.join(', ') || '—'}</span>, hideOnMobile: true },
              { key: 'active', label: 'Active', render: (t) => <Badge tone={t.is_active ? 'success' : 'outline'}>{t.is_active ? 'On' : 'Off'}</Badge> },
              { key: 'updated', label: 'Updated', render: (t) => fmtDate(t.updated_at), hideOnMobile: true },
            ]} />
        )}
      </ErrorOr>
      {editing && <TemplateEditor value={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); state.reload(); }} />}
    </Panel>
  );
}

function TemplateEditor({ value, onClose, onSaved }: { value: typeof blank & { id?: string }; onClose: () => void; onSaved: () => void }) {
  const [t, setT] = React.useState(value);
  const [vars, setVars] = React.useState<Record<string, string>>({});
  const [preview, setPreview] = React.useState<{ subject: string | null; body: string; variables: string[] } | null>(null);
  React.useEffect(() => {
    const h = setTimeout(async () => { if (t.body) setPreview(await mutate('/admin/notifications/preview', 'POST', { subject: t.subject || null, body: t.body, vars })); }, 350);
    return () => clearTimeout(h);
  }, [t.body, t.subject, vars]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" title={t.id ? `Edit ${t.key}` : 'New template'} className="max-w-2xl" description="Use {{variable}} placeholders. SMS in India needs a DLT-registered template id; WhatsApp needs an approved template name.">
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          const body = { key: t.key, channel: t.channel, locale: t.locale, subject: t.subject || null, body: t.body, providerTemplateId: t.providerTemplateId || null, isActive: t.isActive };
          const r = t.id ? await mutate(`/admin/notifications/templates/${t.id}`, 'PATCH', body, 'Template saved') : await mutate('/admin/notifications/templates', 'POST', body, 'Template created');
          if (r) onSaved();
        }}>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Key" htmlFor="tpl-key"><Input value={t.key} disabled={!!t.id} onChange={(e) => setT({ ...t, key: e.target.value })} className="font-mono text-sm" required /></Field>
            <Field label="Channel" htmlFor="tpl-ch"><NativeSelect value={t.channel} disabled={!!t.id} onChange={(e) => setT({ ...t, channel: e.target.value })}>{['in_app', 'email', 'sms', 'push', 'whatsapp'].map((c) => <option key={c} value={c}>{human(c)}</option>)}</NativeSelect></Field>
            <Field label="Language" htmlFor="tpl-loc"><NativeSelect value={t.locale} disabled={!!t.id} onChange={(e) => setT({ ...t, locale: e.target.value })}>{['en', 'hi', 'ta', 'te', 'kn', 'ml'].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</NativeSelect></Field>
          </div>
          {['email', 'push', 'in_app'].includes(t.channel) && <Field label={t.channel === 'email' ? 'Subject' : 'Title'} htmlFor="tpl-subj" optional><Input value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} /></Field>}
          <Field label="Body" htmlFor="tpl-body"><Textarea value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} className="min-h-36" required /></Field>
          {['sms', 'whatsapp'].includes(t.channel) && <Field label="Provider template id" htmlFor="tpl-pid" optional><Input value={t.providerTemplateId} onChange={(e) => setT({ ...t, providerTemplateId: e.target.value })} /></Field>}
          <label className="flex items-center gap-2 text-sm"><Switch checked={t.isActive} onCheckedChange={(isActive) => setT({ ...t, isActive })} aria-label="Active" />Active</label>
          {preview && (
            <div className="space-y-3 rounded-xl bg-surface-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
              {preview.variables.length > 0 && (
                <div className="grid grid-cols-2 gap-2">{preview.variables.map((v) => <Input key={v} aria-label={`Sample value for ${v}`} placeholder={v} value={vars[v] ?? ''} onChange={(e) => setVars({ ...vars, [v]: e.target.value })} className="h-9 text-sm" />)}</div>
              )}
              {preview.subject && <p className="font-medium">{preview.subject}</p>}
              <p className="whitespace-pre-line text-sm">{preview.body}</p>
            </div>
          )}
          <div className="flex justify-between">
            {t.id ? <Button type="button" variant="ghost" className="text-danger" onClick={async () => { if (window.confirm('Delete this template?') && (await mutate(`/admin/notifications/templates/${t.id}`, 'DELETE', undefined, 'Deleted'))) onSaved(); }}>Delete</Button> : <span />}
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Broadcast() {
  const [f, setF] = React.useState({ title: '', body: '', href: '', planCode: '', country: '', city: '' });
  const [count, setCount] = React.useState<{ recipients: number; capped: boolean } | null>(null);
  const payload = (dryRun: boolean) => ({ title: f.title, body: f.body, href: f.href || undefined, audience: { planCode: f.planCode || undefined, country: f.country || undefined, city: f.city || undefined }, dryRun });
  const valid = f.title.trim().length >= 3 && f.body.trim().length >= 3;
  return (
    <Panel title="In-app announcement" description="Delivered to the notification centre of active members in the audience. Use sparingly.">
      <form className="grid gap-4 lg:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-4">
          <Field label="Title" htmlFor="b-title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} /></Field>
          <Field label="Message" htmlFor="b-body"><Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={1000} className="min-h-28" /></Field>
          <Field label="Link (optional)" htmlFor="b-href" hint="An in-app path such as /app/billing"><Input value={f.href} onChange={(e) => setF({ ...f, href: e.target.value })} placeholder="/app/…" /></Field>
        </div>
        <div className="space-y-4">
          <Field label="Plan" htmlFor="b-plan"><NativeSelect value={f.planCode} onChange={(e) => { setF({ ...f, planCode: e.target.value }); setCount(null); }}><option value="">All plans</option>{['free', 'plus', 'premium', 'elite'].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}</NativeSelect></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country code" htmlFor="b-country" optional><Input value={f.country} onChange={(e) => { setF({ ...f, country: e.target.value.toUpperCase().slice(0, 2) }); setCount(null); }} placeholder="IN" /></Field>
            <Field label="City" htmlFor="b-city" optional><Input value={f.city} onChange={(e) => { setF({ ...f, city: e.target.value }); setCount(null); }} /></Field>
          </div>
          {count && <Notice>{fmtNum(count.recipients)} members will receive this{count.capped ? ' (capped at 10,000 per broadcast)' : ''}.</Notice>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={!valid} onClick={async () => { const r = await mutate<{ recipients: number; capped: boolean }>('/admin/notifications/broadcast', 'POST', payload(true)); if (r) setCount(r); }}>Count recipients</Button>
            <ConfirmAction trigger={<Button type="button" disabled={!valid || !count || count.recipients === 0}><Send />Send</Button>} title="Send announcement?" description={`This notifies ${fmtNum(count?.recipients ?? 0)} members and cannot be undone.`} confirmLabel="Send now"
              onConfirm={() => mutate<{ sent: number }>('/admin/notifications/broadcast', 'POST', payload(false), 'Announcement sent').then((r) => { if (r) { setF({ ...f, title: '', body: '' }); setCount(null); } return r; })} />
          </div>
        </div>
      </form>
    </Panel>
  );
}
