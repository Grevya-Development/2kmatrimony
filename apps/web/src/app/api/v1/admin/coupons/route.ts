import { route, parseJson } from '@/server/http';
import * as billing from '@/server/admin/billing';

export const GET = route({ admin: 'payments.read' }, async () => billing.listCoupons());

export const POST = route({ admin: 'coupons.manage' }, async ({ req, auth }) => billing.createCoupon(auth, await parseJson(req, billing.couponSchema)));
