import { route, parseJson } from '@/server/http';
import * as billing from '@/server/admin/billing';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'payments.read' }, async ({ req }) => billing.listRefunds(req, parsePage(req)));

export const POST = route({ admin: 'refunds.manage' }, async ({ req, auth }) => billing.requestRefund(auth, await parseJson(req, billing.refundRequestSchema)));
