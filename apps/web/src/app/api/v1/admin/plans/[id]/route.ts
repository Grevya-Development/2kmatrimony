import { route, parseJson } from '@/server/http';
import * as billing from '@/server/admin/billing';

export const PATCH = route<{ id: string }>({ admin: 'plans.manage' }, async ({ req, auth, params }) => billing.updatePlan(auth, params.id, await parseJson(req, billing.planUpdateSchema)));
