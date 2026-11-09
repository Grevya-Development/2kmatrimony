import { route } from '@/server/http';
import { buildOverview } from '@/server/analytics/reports';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: true }, async ({ req }) => buildOverview(parseRange(req)));
