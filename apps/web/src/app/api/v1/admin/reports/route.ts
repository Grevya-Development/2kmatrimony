import { route } from '@/server/http';
import * as trust from '@/server/admin/trust';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'reports.manage' }, async ({ req, auth }) => trust.listReports(req, parsePage(req), auth));
