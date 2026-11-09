import { route } from '@/server/http';
import * as trust from '@/server/admin/trust';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'risk.review' }, async ({ req }) => trust.listRiskSignals(req, parsePage(req)));
