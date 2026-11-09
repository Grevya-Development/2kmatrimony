'use client';
import * as React from 'react';
import { ChevronLeft, ChevronRight, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { formatInr } from '@2k/shared';
import { api, apiRaw, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge, Button, Dialog, DialogContent, ErrorState, Field, Input, NativeSelect, Skeleton, Textarea } from '@/components/ui';
import { useMe } from '@/components/shell/me-context';

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
export function useAdminData<T>(path: string | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(!!path);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    api<T>(path, { signal: ctrl.signal })
      .then((d) => setData(d))
      .catch((e: unknown) => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Failed to load'); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [path, tick]);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

/** Run a mutation with toast feedback. Returns the data or null on failure. */
export async function mutate<T = unknown>(path: string, method: string, body?: unknown, success?: string): Promise<T | null> {
  try {
    const res = await apiRaw<T>(path, { method, body });
    if (success) toast.success(success);
    return res.data;
  } catch (e) {
    toast.error(e instanceof ApiClientError ? e.message : 'Something went wrong.');
    return null;
  }
}

export function useCan() {
  const { me } = useMe();
  const perms = new Set(me.admin?.permissions ?? []);
  return (p: string) => perms.has('*') || perms.has(p);
}

export interface Paged<T> { items: T[]; total: number; page: number; limit: number; pages: number }

/** Build a query string from a filter object, skipping empty values. */
export const qs = (o: object) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (s: string | null | undefined) => (s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtNum = (n: number | null | undefined) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN').format(n));
export const fmtPct = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? '—' : `${(n * 100).toFixed(digits)}%`);
export const fmtInr = (paise: number | null | undefined) => (paise === null || paise === undefined ? '—' : formatInr(paise));
export const fmtUsd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
export const human = (s: string | null | undefined) => (s ? s.replace(/[_.]/g, ' ') : '—');

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------
export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className }: { title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface shadow-soft', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="text-xs text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function KeyValues({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
          <dd className="mt-0.5 break-words text-ink">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

const STATUS_TONES: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  active: 'success', approved: 'success', captured: 'success', resolved: 'success', actioned: 'success', reviewed_ok: 'success', processed: 'success', published: 'success',
  pending: 'warning', in_review: 'warning', open: 'warning', requested: 'warning', pending_user: 'info', processing: 'info', created: 'neutral', draft: 'neutral',
  suspended: 'danger', rejected: 'danger', failed: 'danger', banned: 'danger', deleted: 'danger', resubmission_required: 'danger', halted: 'danger',
  hidden: 'neutral', cancelled: 'neutral', expired: 'neutral', dismissed: 'neutral', closed: 'neutral', pending_deletion: 'danger', refunded: 'neutral', partially_refunded: 'info',
  urgent: 'danger', high: 'warning', normal: 'neutral', low: 'outline',
};
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge tone="outline">—</Badge>;
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'} className="capitalize">{human(status)}</Badge>;
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-2" aria-busy>{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
export interface Column<T> { key: string; label: string; render?: (row: T) => React.ReactNode; className?: string; hideOnMobile?: boolean }

export function DataTable<T extends object>({ caption, columns, rows, onRowClick, empty = 'Nothing here yet.', loading, rowKey }: {
  caption: string; columns: Column<T>[]; rows: T[] | null | undefined; onRowClick?: (row: T) => void; empty?: string; loading?: boolean; rowKey?: (row: T) => string;
}) {
  if (loading && !rows) return <LoadingRows />;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            {columns.map((c) => <th key={c.key} scope="col" className={cn('px-5 py-2.5 font-medium', c.hideOnMobile && 'hidden md:table-cell', c.className)}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).length === 0 ? (
            <tr><td colSpan={columns.length} className="px-5 py-10 text-center text-muted">{empty}</td></tr>
          ) : (
            (rows ?? []).map((row, i) => (
              <tr
                key={rowKey ? rowKey(row) : String((row as { id?: string | number }).id ?? i)}
                className={cn('border-b border-line/70 last:border-0', onRowClick && 'cursor-pointer hover:bg-surface-2/70 focus-within:bg-surface-2/70')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-5 py-3 align-middle text-ink-2', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>{fmtNum(total)} total</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft /></Button>
        <span>Page {page} of {pages}</span>
        <Button size="sm" variant="ghost" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRight /></Button>
      </div>
    </nav>
  );
}

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); onChange(draft.trim()); }} className="relative min-w-56 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <Input aria-label={label} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="h-10 pl-9" onBlur={() => draft.trim() !== value && onChange(draft.trim())} />
    </form>
  );
}

export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <NativeSelect aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-auto min-w-36 text-sm">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </NativeSelect>
  );
}

// ---------------------------------------------------------------------------
// Date range
// ---------------------------------------------------------------------------
export interface DateRange { from: string; to: string }
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const lastDays = (n: number): DateRange => ({ from: isoDay(new Date(Date.now() - n * 86400_000)), to: isoDay(new Date()) });

export function RangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const presets: [string, number][] = [['7d', 7], ['30d', 30], ['90d', 90], ['1y', 365]];
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
      <div className="inline-flex rounded-full border border-line bg-surface p-0.5">
        {presets.map(([label, n]) => {
          const r = lastDays(n);
          const active = r.from === value.from && r.to === value.to;
          return <button key={label} type="button" aria-pressed={active} onClick={() => onChange(r)} className={cn('rounded-full px-3 py-1 text-xs font-medium', active ? 'bg-ink text-canvas' : 'text-muted hover:text-ink')}>{label}</button>;
        })}
      </div>
      <Input type="date" aria-label="From" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} className="h-9 w-auto text-sm" />
      <span className="text-muted">–</span>
      <Input type="date" aria-label="To" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} className="h-9 w-auto text-sm" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------
export function StatCard({ label, value, previous, current, format = fmtNum, hint, invert }: {
  label: string; value?: React.ReactNode; current?: number | null; previous?: number | null; format?: (n: number) => string; hint?: string; invert?: boolean;
}) {
  const delta = current !== undefined && current !== null && previous !== undefined && previous !== null && previous !== 0 ? (current - previous) / Math.abs(previous) : null;
  const good = delta !== null && (invert ? delta < 0 : delta > 0);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl leading-none text-ink">{value ?? (current === null || current === undefined ? '—' : format(current))}</p>
      <div className="mt-2 flex min-h-5 items-center gap-1.5 text-xs">
        {delta !== null && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', good ? 'text-success' : delta === 0 ? 'text-muted' : 'text-danger')}>
            {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
            {`${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}%`}
            <span className="sr-only">compared with the previous period</span>
          </span>
        )}
        {hint && <span className="text-muted">{hint}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------
export function Drawer({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" title={title} description={description} className="max-w-2xl">{children}</DialogContent>
    </Dialog>
  );
}

/** Confirmation dialog that optionally requires a written reason (and/or typed confirmation). */
export function ConfirmAction({ trigger, title, description, confirmLabel, requireReason, confirmWord, danger, onConfirm, extra }: {
  trigger: React.ReactElement; title: string; description?: string; confirmLabel: string; requireReason?: boolean; confirmWord?: string; danger?: boolean;
  onConfirm: (reason: string) => Promise<unknown>; extra?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [word, setWord] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const id = React.useId();
  const valid = (!requireReason || reason.trim().length >= 5) && (!confirmWord || word === confirmWord);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setReason(''); setWord(''); } }}>
      {React.cloneElement(trigger as React.ReactElement<{ onClick?: () => void }>, { onClick: () => setOpen(true) })}
      <DialogContent title={title} description={description}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setBusy(true);
            const ok = await onConfirm(reason.trim()).then((r) => r !== null).catch(() => false);
            setBusy(false);
            if (ok) setOpen(false);
          }}
        >
          {extra}
          {requireReason && (
            <Field label="Reason (recorded in the audit log)" htmlFor={`${id}-reason`} hint="At least 5 characters.">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-24" required />
            </Field>
          )}
          {confirmWord && (
            <Field label={`Type ${confirmWord} to confirm`} htmlFor={`${id}-word`}>
              <Input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={!valid} loading={busy}>{confirmLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** JSON textarea with live validation. */
export function JsonEditor({ value, onChange, label, id, rows = 10 }: { value: string; onChange: (v: string) => void; label: string; id: string; rows?: number }) {
  let error: string | null = null;
  try { JSON.parse(value); } catch (e) { error = e instanceof Error ? e.message : 'Invalid JSON'; }
  return (
    <Field label={label} htmlFor={id} error={error}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} spellCheck={false} className="font-mono text-xs leading-relaxed" />
    </Field>
  );
}

export function ErrorOr<T>({ state, children, rows }: { state: { data: T | null; error: string | null; loading: boolean; reload: () => void }; children: (d: T) => React.ReactNode; rows?: number }) {
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <LoadingRows rows={rows} />;
  return <>{children(state.data)}</>;
}

/** Download a CSV from an authenticated admin endpoint. */
export async function downloadCsv(path: string, filename: string) {
  const res = await fetch(`/api/v1${path}`, { credentials: 'same-origin' });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    toast.error(j?.error?.message ?? 'Export failed.');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
