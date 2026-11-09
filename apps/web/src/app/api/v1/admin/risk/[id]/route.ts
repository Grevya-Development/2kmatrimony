import { route, parseJson } from '@/server/http';
import * as trust from '@/server/admin/trust';

export const PATCH = route<{ id: string }>({ admin: 'risk.review' }, async ({ req, auth, params }) => { await trust.reviewRiskSignal(auth, params.id, await parseJson(req, trust.riskUpdateSchema)); return { ok: true }; });
