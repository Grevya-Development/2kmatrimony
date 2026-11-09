import { route } from '@/server/http';
import * as billing from '@/server/admin/billing';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'payments.read' }, async ({ req }) => billing.listPayments(req, parsePage(req)));
