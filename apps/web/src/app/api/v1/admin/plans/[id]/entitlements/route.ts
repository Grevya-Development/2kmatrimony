import { route, parseJson } from '@/server/http';
import * as billing from '@/server/admin/billing';

export const PUT = route<{ id: string }>({ admin: 'plans.manage' }, async ({ req, auth, params }) => { const b = await parseJson(req, billing.entitlementsSchema); await billing.setEntitlements(auth, params.id, b.values); return { ok: true }; });
