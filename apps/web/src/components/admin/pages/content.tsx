'use client';
import * as React from 'react';
import { Plus } from 'lucide-react';
import { Badge, Button, Dialog, DialogContent, Field, Input, NativeSelect, Switch, Textarea } from '@/components/ui';
import { AdminHeader, DataTable, ErrorOr, FilterSelect, Panel, fmtDate, human, mutate, qs, useAdminData } from '../kit';

interface Entry { id: string; kind: string; slug: string; locale: string; title: string; body: string; is_published: boolean; sort_order: number; consent_reference: string | null; updated_at: string }
const KINDS = ['faq', 'success_story', 'legal', 'announcement', 'help_article'];
const blank = { kind: 'faq', slug: '', locale: 'en', title: '', body: '', isPublished: false, sortOrder: 0, consentReference: '' };

export function ContentPage() {
  const [kind, setKind] = React.useState('');
  const state = useAdminData<Entry[]>(`/admin/cms${qs({ kind })}`);
  const [editing, setEditing] = React.useState<(typeof blank & { id?: string }) | null>(null);
  return (
    <>
      <AdminHeader title="Content" description="FAQs, success stories, legal pages, announcements and help articles shown on the website and apps." actions={<Button onClick={() => setEditing({ ...blank })}><Plus />New entry</Button>} />
      <Panel>
        <div className="mb-4"><FilterSelect label="Kind" value={kind} onChange={setKind} options={[['', 'All kinds'], ...KINDS.map((k) => [k, human(k)] as [string, string])]} /></div>
        <ErrorOr state={state}>
          {(rows) => (
            <DataTable<Entry> caption="Content entries" rows={rows} empty="No entries."
              onRowClick={(e) => setEditing({ id: e.id, kind: e.kind, slug: e.slug, locale: e.locale, title: e.title, body: e.body, isPublished: e.is_published, sortOrder: e.sort_order, consentReference: e.consent_reference ?? '' })}
              columns={[
                { key: 'title', label: 'Title', render: (e) => <span className="text-ink">{e.title}</span> },
                { key: 'kind', label: 'Kind', render: (e) => <span className="capitalize">{human(e.kind)}</span> },
                { key: 'locale', label: 'Lang', render: (e) => e.locale.toUpperCase(), hideOnMobile: true },
                { key: 'order', label: 'Order', render: (e) => e.sort_order, hideOnMobile: true },
                { key: 'published', label: 'Status', render: (e) => <Badge tone={e.is_published ? 'success' : 'outline'}>{e.is_published ? 'Published' : 'Draft'}</Badge> },
                { key: 'updated', label: 'Updated', render: (e) => fmtDate(e.updated_at), hideOnMobile: true },
              ]} />
          )}
        </ErrorOr>
      </Panel>
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent side="right" title={editing.id ? 'Edit entry' : 'New entry'} className="max-w-2xl">
            <form className="space-y-4" onSubmit={async (ev) => {
              ev.preventDefault();
              const body = { kind: editing.kind, slug: editing.slug, locale: editing.locale, title: editing.title, body: editing.body, isPublished: editing.isPublished, sortOrder: Number(editing.sortOrder), consentReference: editing.consentReference || null };
              const r = editing.id ? await mutate(`/admin/cms/${editing.id}`, 'PATCH', body, 'Saved') : await mutate('/admin/cms', 'POST', body, 'Created');
              if (r) { setEditing(null); state.reload(); }
            }}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kind" htmlFor="cms-kind"><NativeSelect value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{human(k)}</option>)}</NativeSelect></Field>
                <Field label="Language" htmlFor="cms-locale"><NativeSelect value={editing.locale} onChange={(e) => setEditing({ ...editing, locale: e.target.value })}>{['en', 'hi', 'ta', 'te', 'kn', 'ml'].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</NativeSelect></Field>
              </div>
              <Field label="Title" htmlFor="cms-title"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: editing.id || editing.slug ? editing.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} required /></Field>
              <Field label="Slug" htmlFor="cms-slug" hint="Lowercase letters, numbers and hyphens."><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="font-mono text-sm" required /></Field>
              <Field label="Body" htmlFor="cms-body" hint="Plain text with line breaks."><Textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="min-h-56" required /></Field>
              {editing.kind === 'success_story' && (
                <Field label="Consent reference" htmlFor="cms-consent" hint="Required to publish: reference to the couple’s written consent (form id, date).">
                  <Input value={editing.consentReference} onChange={(e) => setEditing({ ...editing, consentReference: e.target.value })} />
                </Field>
              )}
              <div className="flex items-center gap-6">
                <Field label="Sort order" htmlFor="cms-order"><Input type="number" min={0} value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} className="w-28" /></Field>
                <label className="mt-6 flex items-center gap-2 text-sm"><Switch checked={editing.isPublished} onCheckedChange={(isPublished) => setEditing({ ...editing, isPublished })} aria-label="Published" />Published</label>
              </div>
              <div className="flex justify-between">
                {editing.id ? <Button type="button" variant="ghost" className="text-danger" onClick={async () => { if (window.confirm('Delete this entry permanently?') && (await mutate(`/admin/cms/${editing.id}`, 'DELETE', undefined, 'Deleted'))) { setEditing(null); state.reload(); } }}>Delete</Button> : <span />}
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
