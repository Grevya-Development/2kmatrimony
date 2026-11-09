'use client';
import * as React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui';
import { SimpleBarChart, TimeAreaChart } from '@/components/charts/charts';
import { AdminHeader, DataTable, ErrorOr, Panel, RangePicker, downloadCsv, lastDays, qs, useAdminData, useCan } from '../kit';

interface Report { title: string; columns: { key: string; label: string }[]; rows: Record<string, string | number | null>[] }
const LABELS: Record<string, string> = {
  acquisition: 'Acquisition', funnel: 'Onboarding funnel', completion: 'Profile completion', search: 'Search', matching: 'Match quality',
  engagement: 'Engagement', subscriptions: 'Subscriptions', revenue: 'Revenue', retention: 'Retention',
};

export function AnalyticsPage() {
  const can = useCan();
  const [report, setReport] = React.useState('acquisition');
  const [range, setRange] = React.useState(lastDays(30));
  const state = useAdminData<{ reports: string[]; report: Report }>(`/admin/analytics${qs({ report, ...range })}`);
  return (
    <>
      <AdminHeader title="Analytics" description="Every view can be exported as CSV." actions={<RangePicker value={range} onChange={setRange} />} />
      <div role="tablist" aria-label="Reports" className="mb-4 flex flex-wrap gap-1">
        {Object.entries(LABELS).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={report === k} type="button" onClick={() => setReport(k)}
            className={`rounded-full px-3.5 py-1.5 text-sm ${report === k ? 'bg-ink text-canvas' : 'border border-line bg-surface text-ink-2 hover:text-ink'}`}>{l}</button>
        ))}
      </div>
      <ErrorOr state={state}>
        {({ report: r }) => {
          const numeric = r.columns.slice(1).filter((c) => r.rows.some((row) => typeof row[c.key] === 'number'));
          const timeSeries = r.columns[0]?.key === 'day';
          return (
            <Panel title={r.title} actions={can('analytics.export') ? <Button size="sm" variant="secondary" onClick={() => downloadCsv(`/admin/analytics${qs({ report, ...range, format: 'csv' })}`, `${report}-${range.from}-${range.to}.csv`)}><Download />Export CSV</Button> : undefined}>
              {r.rows.length > 0 && numeric.length > 0 && (
                <div className="mb-6">
                  {timeSeries
                    ? <TimeAreaChart label={r.title} data={r.rows as Record<string, unknown>[]} series={numeric.filter((c) => !c.key.toLowerCase().includes('pct') && c.key !== 'acceptance').slice(0, 3).map((c) => ({ key: c.key, label: c.label }))} />
                    : <SimpleBarChart label={r.title} data={r.rows as Record<string, unknown>[]} xKey={r.columns[0]!.key} series={numeric.slice(0, 2).map((c) => ({ key: c.key, label: c.label }))} layout={r.rows.length > 6 && !timeSeries ? 'vertical' : 'horizontal'} height={Math.max(220, r.rows.length * 28)} />}
                </div>
              )}
              <DataTable caption={r.title} rows={r.rows.map((row, i) => ({ ...row, id: i }))} empty="No data for this period."
                columns={r.columns.map((c) => ({ key: c.key, label: c.label, render: (row: Record<string, unknown>) => row[c.key] === null || row[c.key] === undefined ? '—' : typeof row[c.key] === 'number' ? new Intl.NumberFormat('en-IN').format(row[c.key] as number) : String(row[c.key]) }))} />
            </Panel>
          );
        }}
      </ErrorOr>
    </>
  );
}
