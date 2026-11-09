import { route, errors } from '@/server/http';
import { buildReport, REPORTS, type ReportKey } from '@/server/analytics/reports';
import { csvResponse, parseRange } from '@/server/admin/common';
import { audit } from '@/server/audit';

export const GET = route({ admin: 'analytics.read' }, async ({ req, auth }) => {
    const url = new URL(req.url);
    const key = url.searchParams.get('report') ?? 'acquisition';
    if (!(REPORTS as readonly string[]).includes(key)) throw errors.validation('Unknown report.');
    const range = parseRange(req);
    const report = await buildReport(key as ReportKey, range);
    if (url.searchParams.get('format') === 'csv') {
      if (!auth.admin!.can('analytics.export')) throw errors.forbidden('Exporting requires the analytics.export permission.');
      await audit(auth, { action: 'admin.analytics.export', entityType: 'report', entityId: key, metadata: { from: range.from, to: range.to, rows: report.rows.length } });
      return csvResponse(report, `${key}-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`);
    }
    return { reports: REPORTS, report };
  });
