import 'server-only';
import { db } from '@/lib/supabase/admin';
import { errors } from '@/server/http';
import { previousRange, type Range, type Report } from '@/server/admin/common';

export const REPORTS = ['acquisition', 'funnel', 'completion', 'search', 'matching', 'engagement', 'subscriptions', 'revenue', 'retention'] as const;
export type ReportKey = (typeof REPORTS)[number];

const iso = (d: Date) => d.toISOString();
const args = (r: Range) => ({ p_from: iso(r.from), p_to: iso(r.to) });

async function series(metric: string, r: Range) {
  const { data, error } = await db().rpc('admin_timeseries', { ...args(r), p_metric: metric });
  if (error) throw error;
  return (data ?? []).map((d) => ({ day: d.day, value: Number(d.value) }));
}

async function multiSeries(metrics: string[], r: Range) {
  const all = await Promise.all(metrics.map((m) => series(m, r)));
  return all[0]!.map((row, i) => Object.fromEntries([['day', row.day], ...metrics.map((m, j) => [m, all[j]![i]?.value ?? 0])])) as Record<string, string | number>[];
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export async function buildOverview(r: Range) {
  const prev = previousRange(r);
  const [cur, before, daily] = await Promise.all([
    db().rpc('admin_overview_metrics', args(r)),
    db().rpc('admin_overview_metrics', args(prev)),
    multiSeries(['signups', 'revenue', 'interests', 'connections', 'messages'], r),
  ]);
  if (cur.error) throw cur.error;
  return { range: { from: iso(r.from), to: iso(r.to) }, current: cur.data, previous: before.data, series: daily };
}

export async function buildReport(key: ReportKey, r: Range): Promise<Report> {
  const c = db();
  switch (key) {
    case 'acquisition': {
      const rows = await multiSeries(['signups', 'profiles', 'activations'], r);
      const { data: events } = await c.from('analytics_events').select('platform').eq('event', 'signup').gte('created_at', iso(r.from)).lt('created_at', iso(r.to)).limit(50000);
      const byPlatform = new Map<string, number>();
      for (const e of events ?? []) byPlatform.set(e.platform ?? 'unknown', (byPlatform.get(e.platform ?? 'unknown') ?? 0) + 1);
      return {
        title: `Acquisition${byPlatform.size ? ` — platforms: ${[...byPlatform.entries()].map(([k, v]) => `${k} ${v}`).join(', ')}` : ''}`,
        columns: [{ key: 'day', label: 'Day' }, { key: 'signups', label: 'Sign-ups' }, { key: 'profiles', label: 'Profiles started' }, { key: 'activations', label: 'Profiles activated' }],
        rows,
      };
    }
    case 'funnel': {
      const { data, error } = await c.rpc('admin_onboarding_funnel', args(r));
      if (error) throw error;
      const first = Number(data?.[0]?.users ?? 0);
      return {
        title: 'Onboarding funnel (users who signed up in range)',
        columns: [{ key: 'step', label: 'Step' }, { key: 'users', label: 'Users' }, { key: 'pctOfSignups', label: '% of sign-ups' }, { key: 'pctOfPrevious', label: '% of previous step' }],
        rows: (data ?? []).map((s, i, arr) => ({ step: s.step, users: Number(s.users), pctOfSignups: pct(Number(s.users), first), pctOfPrevious: i === 0 ? 100 : pct(Number(s.users), Number(arr[i - 1]!.users)) })),
      };
    }
    case 'completion': {
      const { data, error } = await c.rpc('admin_completion_distribution');
      if (error) throw error;
      return {
        title: 'Profile completion distribution (all profiles)',
        columns: [{ key: 'bucket', label: 'Completion %' }, { key: 'profiles', label: 'Profiles' }],
        rows: (data ?? []).map((b) => ({ bucket: b.bucket === 100 ? '100' : `${b.bucket}–${b.bucket + 9}`, profiles: Number(b.profiles) })),
      };
    }
    case 'search': {
      const rows = await multiSeries(['searches', 'ai_requests'], r);
      const { data: smart } = await c.from('ai_usage_logs').select('created_at').eq('feature', 'smart_search').gte('created_at', iso(r.from)).lt('created_at', iso(r.to)).limit(50000);
      const smartByDay = new Map<string, number>();
      for (const s of smart ?? []) { const d = s.created_at.slice(0, 10); smartByDay.set(d, (smartByDay.get(d) ?? 0) + 1); }
      return {
        title: 'Search usage',
        columns: [{ key: 'day', label: 'Day' }, { key: 'searches', label: 'Searches (tracked)' }, { key: 'smart', label: 'AI smart searches' }],
        rows: rows.map((x) => ({ day: x.day as string, searches: x.searches as number, smart: smartByDay.get(String(x.day)) ?? 0 })),
      };
    }
    case 'matching': {
      const rows = await multiSeries(['recommendations', 'interests', 'accepted_interests', 'connections'], r);
      return {
        title: 'Match quality & conversion',
        columns: [{ key: 'day', label: 'Day' }, { key: 'recommendations', label: 'Recommendations' }, { key: 'interests', label: 'Interests sent' }, { key: 'accepted_interests', label: 'Interests accepted' }, { key: 'acceptance', label: 'Acceptance %' }, { key: 'connections', label: 'Connections' }],
        rows: rows.map((x) => ({ ...x, acceptance: pct(Number(x.accepted_interests), Number(x.interests)) })) as Report['rows'],
      };
    }
    case 'engagement': {
      const { data, error } = await c.rpc('admin_engagement', args(r));
      if (error) throw error;
      const e = data as { avgDau: number; wau: number; mau: number; messagesPerDay: number; daily: { day: string; value: number }[] };
      const msgs = await series('messages', r);
      const dau = new Map(e.daily.map((d) => [d.day, d.value]));
      return {
        title: `Engagement — avg DAU ${e.avgDau}, WAU ${e.wau}, MAU ${e.mau}, ${e.messagesPerDay} messages/day`,
        columns: [{ key: 'day', label: 'Day' }, { key: 'dau', label: 'Daily active members' }, { key: 'messages', label: 'Messages' }],
        rows: msgs.map((m) => ({ day: m.day, dau: dau.get(m.day) ?? 0, messages: m.value })),
      };
    }
    case 'subscriptions': {
      const { data: subs } = await c.from('subscriptions').select('status, created_at, plans(code)').gte('created_at', iso(r.from)).lt('created_at', iso(r.to)).limit(50000);
      const { data: m } = await c.rpc('admin_overview_metrics', args(r));
      const agg = new Map<string, Record<string, number>>();
      for (const s of subs ?? []) {
        const code = (s.plans as unknown as { code: string } | null)?.code ?? 'unknown';
        const row = agg.get(code) ?? { created: 0, active: 0, cancelled: 0, expired: 0 };
        row.created!++;
        if (s.status in row) row[s.status]!++;
        agg.set(code, row);
      }
      const om = m as { conversionRate: number; churnRate: number; paidUsers: number } | null;
      return {
        title: `Subscriptions — paid users ${om?.paidUsers ?? 0}, conversion ${pct(om?.conversionRate ?? 0, 1)}%, churn ${pct(om?.churnRate ?? 0, 1)}%`,
        columns: [{ key: 'plan', label: 'Plan' }, { key: 'created', label: 'New subscriptions' }, { key: 'active', label: 'Still active' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'expired', label: 'Expired' }],
        rows: [...agg.entries()].map(([plan, v]) => ({ plan, ...v })),
      };
    }
    case 'revenue': {
      const rows = await series('revenue', r);
      const { data: refunds } = await c.from('refunds').select('amount_paise, updated_at').eq('status', 'processed').gte('updated_at', iso(r.from)).lt('updated_at', iso(r.to));
      const refundByDay = new Map<string, number>();
      for (const x of refunds ?? []) { const d = x.updated_at.slice(0, 10); refundByDay.set(d, (refundByDay.get(d) ?? 0) + x.amount_paise); }
      return {
        title: 'Revenue (INR, GST-inclusive)',
        columns: [{ key: 'day', label: 'Day' }, { key: 'gross', label: 'Gross ₹' }, { key: 'refunds', label: 'Refunds ₹' }, { key: 'net', label: 'Net ₹' }],
        rows: rows.map((x) => {
          const refundsPaise = refundByDay.get(x.day) ?? 0;
          return { day: x.day, gross: x.value / 100, refunds: refundsPaise / 100, net: (x.value - refundsPaise) / 100 };
        }),
      };
    }
    case 'retention': {
      // Weekly sign-up cohorts over the last 8 weeks: share active in the last 7 days.
      const since = new Date(Date.now() - 8 * 7 * 86400_000);
      const { data } = await c.from('app_users').select('created_at, last_active_at').gte('created_at', iso(since)).neq('status', 'deleted').limit(100000);
      const weekAgo = Date.now() - 7 * 86400_000;
      const cohorts = new Map<string, { size: number; active: number }>();
      for (const u of data ?? []) {
        const d = new Date(u.created_at);
        const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
        const k = monday.toISOString().slice(0, 10);
        const e = cohorts.get(k) ?? { size: 0, active: 0 };
        e.size++;
        if (u.last_active_at && new Date(u.last_active_at).getTime() >= weekAgo) e.active++;
        cohorts.set(k, e);
      }
      return {
        title: 'Weekly cohort retention (active in the last 7 days)',
        columns: [{ key: 'cohort', label: 'Cohort week' }, { key: 'size', label: 'Sign-ups' }, { key: 'active', label: 'Active last 7d' }, { key: 'retention', label: 'Retention %' }],
        rows: [...cohorts.entries()].sort().map(([cohort, v]) => ({ cohort, size: v.size, active: v.active, retention: pct(v.active, v.size) })),
      };
    }
    default:
      throw errors.notFound('Unknown report.');
  }
}
