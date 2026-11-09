import { route, parseJson } from '@/server/http';
import * as billing from '@/server/admin/billing';

export const PATCH = route<{ id: string }>({ admin: 'coupons.manage' }, async ({ req, auth, params }) => billing.updateCoupon(auth, params.id, await parseJson(req, billing.couponPatchSchema)));

export const DELETE = route<{ id: string }>({ admin: 'coupons.manage' }, async ({ auth, params }) => { await billing.deleteCoupon(auth, params.id); return { ok: true }; });
