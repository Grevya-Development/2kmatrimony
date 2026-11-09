import { route, parseJson } from '@/server/http';
import * as billing from '@/server/admin/billing';

export const GET = route({ admin: 'plans.manage' }, async () => billing.listPlansAdmin());

export const POST = route({ admin: 'plans.manage' }, async ({ req, auth }) => billing.createPlan(auth, await parseJson(req, billing.planCreateSchema)));
