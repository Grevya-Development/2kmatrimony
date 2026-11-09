import { route, parseJson } from '@/server/http';
import * as billing from '@/server/admin/billing';

export const POST = route<{ id: string }>({ admin: 'plans.manage' }, async ({ req, auth, params }) => billing.upsertPrice(auth, params.id, await parseJson(req, billing.priceSchema)));
