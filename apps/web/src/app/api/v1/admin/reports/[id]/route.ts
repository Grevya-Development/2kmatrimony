import { route, parseJson } from '@/server/http';
import * as trust from '@/server/admin/trust';

export const GET = route<{ id: string }>({ admin: 'reports.manage' }, async ({ params }) => trust.getReport(params.id));

export const PATCH = route<{ id: string }>({ admin: 'reports.manage' }, async ({ req, auth, params }) => { await trust.updateReport(auth, params.id, await parseJson(req, trust.reportUpdateSchema)); return { ok: true }; });
