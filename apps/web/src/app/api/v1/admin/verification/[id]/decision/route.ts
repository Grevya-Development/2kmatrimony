import { route, parseJson } from '@/server/http';
import * as trust from '@/server/admin/trust';

export const POST = route<{ id: string }>({ admin: 'verification.review' }, async ({ req, auth, params }) => { await trust.decideVerification(auth, params.id, await parseJson(req, trust.verificationDecisionSchema)); return { ok: true }; });
