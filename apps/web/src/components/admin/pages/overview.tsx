'use client';
import * as React from 'react';
import Link from 'next/link';
import { useMe } from '@/components/shell/me-context';
import { AdminHeader, ErrorOr, Panel, RangePicker, StatCard, fmtInr, fmtNum, fmtPct, lastDays, qs, useAdminData, useCan } from '../kit';
import { TimeAreaChart } from '@/components/charts/charts';

type Metrics = Record<string, number | null>;
interface Overview { current: Metrics; previous: Metrics; series: Record<string, number | string>[] }

export function OverviewPage() {
  const [range, setRange] = React.useState(lastDays(30));
  const state = useAdminData<Overview>(`/admin/overview${qs(range)}`);
  const can = useCan();
  const payments = useMe().me.featureFlags.payments === true;
  return (
    <>
      <AdminHeader title="Overview" description="Platform health at a glance. Changes are compared with the previous period of the same length." actions={<RangePicker value={range} onChange={setRange} />} />
      <ErrorOr state={state} rows={8}>
        {({ current: c, previous: p, series }) => (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total members" current={c.totalUsers} previous={p.totalUsers} />
              <StatCard label="Active (7 days)" current={c.activeUsers7d} previous={p.activeUsers7d} hint={`${fmtNum(c.activeUsers30d)} in 30 days`} />
              <StatCard label="New registrations" current={c.newRegistrations} previous={p.newRegistrations} />
              {payments
                ? <StatCard label="Revenue (net)" current={c.revenuePaise} previous={p.revenuePaise} format={(n) => fmtInr(n)} hint={c.refundedPaise ? `${fmtInr(c.refundedPaise)} refunded` : undefined} />
                : <StatCard label="Hand-picked introductions" current={c.introductions} previous={p.introductions} />}
              <StatCard label="Verified profiles" current={c.verifiedProfiles} hint={`of ${fmtNum(c.activeProfiles)} active`} />
              <StatCard label="Recommendations" current={c.recommendations} previous={p.recommendations} />
              <StatCard label="Mutual interests" current={c.mutualInterests} previous={p.mutualInterests} hint={`${fmtNum(c.interestsSent)} sent`} />
              <StatCard label="Connections" current={c.connections} previous={p.connections} />
              {payments
                ? <StatCard label="Conversion" value={fmtPct(c.conversionRate)} current={c.conversionRate} previous={p.conversionRate} hint={`${fmtNum(c.paidUsers)} paid`} />
                : <StatCard label="Awaiting screening" current={c.pendingScreening} invert />}
              <StatCard label="30-day retention" value={c.retention30d === null ? '—' : fmtPct(c.retention30d)} hint="Cohort active in last 7 days" />
              {payments && <StatCard label="Churn" value={fmtPct(c.churnRate)} current={c.churnRate} previous={p.churnRate} invert />}
              <StatCard label="Open reports" current={c.openReports} hint={`${fmtNum(c.openTickets)} open tickets`} invert />
            </div>
            <div className={payments ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'}>
              <Panel title="Registrations & activity">
                <TimeAreaChart label="Daily registrations, interests and connections" data={series} series={[{ key: 'signups', label: 'Sign-ups' }, { key: 'interests', label: 'Interests' }, { key: 'connections', label: 'Connections' }]} />
              </Panel>
              {payments && (
                <Panel title="Revenue">
                  <TimeAreaChart label="Daily gross revenue" data={series.map((s) => ({ ...s, revenue: Number(s.revenue) }))} series={[{ key: 'revenue', label: 'Gross revenue' }]} format={(n) => fmtInr(n)} />
                </Panel>
              )}
            </div>
            <Panel title="Needs attention">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {can('profiles.moderate') && <QueueLink href="/admin/screening" label="Profiles awaiting screening" value={c.pendingScreening} />}
                {can('verification.review') && <QueueLink href="/admin/verification" label="Pending verifications" value={c.pendingVerifications} />}
                {can('reports.manage') && <QueueLink href="/admin/moderation" label="Open reports" value={c.openReports} />}
                {can('support.read') && <QueueLink href="/admin/support" label="Open support tickets" value={c.openTickets} />}
              </div>
            </Panel>
          </div>
        )}
      </ErrorOr>
    </>
  );
}

function QueueLink({ href, label, value }: { href: string; label: string; value: number | null | undefined }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 hover:border-line-strong hover:bg-surface-2">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="font-serif text-2xl text-ink">{fmtNum(value)}</span>
    </Link>
  );
}
