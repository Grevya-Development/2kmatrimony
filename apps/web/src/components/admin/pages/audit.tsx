'use client';
import * as React from 'react';
import { Input } from '@/components/ui';
import { AdminHeader, DataTable, Drawer, ErrorOr, FilterSelect, KeyValues, Pager, Panel, SearchBox, fmtDateTime, human, qs, useAdminData, type Paged } from '../kit';

interface Row { id: number; actor_user_id: string | null; actorName: string | null; actor_type: string; action: string; entity_type: string; entity_id: string | null; before_data: unknown; after_data: unknown; metadata: Record<string, unknown>; created_at: string }

/** Flat key → value map for a readable before/after comparison. */
function flatten(v: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (v === null || v === undefined) return out;
  if (typeof v !== 'object' || Array.isArray(v)) { out[prefix || 'value'] = JSON.stringify(v); return out; }
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (x && typeof x === 'object' && !Array.isArray(x)) flatten(x, key, out); else out[key] = JSON.stringify(x);
  }
  return out;
}

export function AuditPage() {
  const [f, setF] = React.useState({ action: '', entityType: '', entityId: '', actor: '', actorType: '', from: '', to: '', page: 1 });
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p, page: 1 }));
  const state = useAdminData<Paged<Row>>(`/admin/audit${qs(f)}`);
  const [open, setOpen] = React.useState<Row | null>(null);
  return (
    <>
      <AdminHeader title="Audit logs" description="Append-only record of sensitive and administrative actions. Entries cannot be edited or deleted." />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <SearchBox label="Action prefix" value={f.action} onChange={(action) => set({ action })} placeholder="Action, e.g. admin.user" />
          <SearchBox label="Actor email or id" value={f.actor} onChange={(actor) => set({ actor })} placeholder="Actor email or id" />
          <Input aria-label="Entity type" placeholder="Entity type" value={f.entityType} onChange={(e) => set({ entityType: e.target.value })} className="h-10 w-36 text-sm" />
          <Input aria-label="Entity id" placeholder="Entity id" value={f.entityId} onChange={(e) => set({ entityId: e.target.value })} className="h-10 w-44 text-sm" />
          <FilterSelect label="Actor type" value={f.actorType} onChange={(actorType) => set({ actorType })} options={[['', 'Any actor'], ['admin', 'Admin'], ['user', 'Member'], ['family', 'Family'], ['system', 'System']]} />
          <Input type="date" aria-label="From" value={f.from} onChange={(e) => set({ from: e.target.value })} className="h-10 w-auto text-sm" />
          <Input type="date" aria-label="To" value={f.to} onChange={(e) => set({ to: e.target.value })} className="h-10 w-auto text-sm" />
        </div>
        <ErrorOr state={state}>
          {(d) => (
            <>
              <DataTable<Row> caption="Audit log entries" rows={d.items} onRowClick={setOpen}
                columns={[
                  { key: 'when', label: 'When', render: (r) => fmtDateTime(r.created_at) },
                  { key: 'action', label: 'Action', render: (r) => <span className="font-mono text-xs text-ink">{r.action}</span> },
                  { key: 'actor', label: 'Actor', render: (r) => `${r.actorName ?? (r.actor_user_id ? 'Member' : 'System')} (${r.actor_type})` },
                  { key: 'entity', label: 'Entity', render: (r) => <span className="text-xs">{r.entity_type}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ''}</span>, hideOnMobile: true },
                ]} />
              <Pager page={d.page} pages={d.pages} total={d.total} onPage={(page) => setF({ ...f, page })} />
            </>
          )}
        </ErrorOr>
      </Panel>
      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)} title="Audit entry">
        {open && <AuditDetail row={open} />}
      </Drawer>
    </>
  );
}

function AuditDetail({ row }: { row: Row }) {
  const before = flatten(row.before_data);
  const after = flatten(row.after_data);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return (
    <div className="space-y-5">
      <KeyValues items={[['Action', <span key="a" className="font-mono text-xs">{row.action}</span>], ['When', fmtDateTime(row.created_at)], ['Actor', `${row.actorName ?? row.actor_user_id ?? 'System'} (${row.actor_type})`], ['Entity', `${row.entity_type} ${row.entity_id ?? ''}`]]} />
      {keys.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="mb-2 text-left text-sm font-semibold text-ink">Changes</caption>
            <thead><tr className="text-left text-muted"><th scope="col" className="py-1 pr-3">Field</th><th scope="col" className="py-1 pr-3">Before</th><th scope="col" className="py-1">After</th></tr></thead>
            <tbody>
              {keys.map((k) => {
                const changed = before[k] !== after[k];
                return (
                  <tr key={k} className="border-t border-line align-top">
                    <td className="py-1.5 pr-3 font-mono">{human(k)}</td>
                    <td className={`py-1.5 pr-3 font-mono break-all ${changed ? 'bg-danger-bg/60' : ''}`}>{before[k] ?? '—'}</td>
                    <td className={`py-1.5 font-mono break-all ${changed ? 'bg-success-bg/60' : ''}`}>{after[k] ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {Object.keys(row.metadata ?? {}).length > 0 && <pre className="overflow-auto rounded-xl bg-surface-2 p-3 text-xs">{JSON.stringify(row.metadata, null, 2)}</pre>}
    </div>
  );
}
