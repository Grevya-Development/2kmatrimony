import 'server-only';
import { z } from 'zod';
import { errors, validate } from '@/server/http';

/** Date range from ?from=YYYY-MM-DD&to=YYYY-MM-DD (to inclusive). Defaults to last 30 days. */
export interface Range { from: Date; to: Date; days: number }

export function parseRange(req: Request, defaultDays = 30): Range {
  const url = new URL(req.url);
  const toParam = url.searchParams.get('to');
  const fromParam = url.searchParams.get('from');
  const to = toParam ? endOfDay(new Date(`${toParam}T00:00:00Z`)) : new Date();
  const from = fromParam ? new Date(`${fromParam}T00:00:00Z`) : new Date(to.getTime() - defaultDays * 86400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) throw errors.validation('Invalid date range.');
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400_000));
  if (days > 730) throw errors.validation('Date range cannot exceed two years.');
  return { from, to, days };
}

function endOfDay(d: Date): Date {
  return new Date(d.getTime() + 86400_000);
}

export function previousRange(r: Range): Range {
  const span = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - span), to: new Date(r.from.getTime()), days: r.days };
}

export interface Page { page: number; limit: number; offset: number }

export function parsePage(req: Request, defaultLimit = 25): Page {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? defaultLimit) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export const paged = <T>(items: T[], total: number | null, p: Page) => ({
  items,
  total: total ?? items.length,
  page: p.page,
  limit: p.limit,
  pages: Math.max(1, Math.ceil((total ?? items.length) / p.limit)),
});

export const qp = (req: Request, key: string): string | null => {
  const v = new URL(req.url).searchParams.get(key);
  return v && v.trim() !== '' ? v.trim() : null;
};

/** Escape a value for PostgREST `.or()` / `ilike` filters. */
export const likeSafe = (s: string) => s.replace(/[%_,()*\\]/g, ' ').trim();

export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!domain) return '•••';
  return `${user!.slice(0, 1)}•••@${domain}`;
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  return d.length <= 4 ? '••••' : `•••• ${d.slice(-4)}`;
}

/** Uniform tabular report — rendered as a table in the UI and exportable as CSV. */
export interface Report {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
}

export function toCsv(report: Report): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = report.columns.map((c) => esc(c.label)).join(',');
  const body = report.rows.map((r) => report.columns.map((c) => esc(r[c.key])).join(',')).join('\n');
  return `${head}\n${body}\n`;
}

export function csvResponse(report: Report, filename: string): Response {
  return new Response(toCsv(report), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename.replace(/[^a-z0-9_.-]/gi, '_')}"`,
      'cache-control': 'no-store',
    },
  });
}

export const reasonSchema = z.string().trim().min(5, 'Please give a reason (at least 5 characters).').max(1000);

export function parseObj<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  return validate(schema, value);
}
