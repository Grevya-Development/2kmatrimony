import { route, parseJson } from '@/server/http';
import * as billing from '@/server/admin/billing';
import { reasonSchema } from '@/server/admin/common';
import { z } from 'zod';

export const POST = route<{ id: string }>({ admin: 'refunds.manage' }, async ({ req, auth, params }) => { const b = await parseJson(req, z.object({ reason: reasonSchema })); await billing.rejectRefund(auth, params.id, b.reason); return { ok: true }; });
