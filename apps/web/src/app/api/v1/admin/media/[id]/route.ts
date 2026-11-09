import { route, parseJson } from '@/server/http';
import * as trust from '@/server/admin/trust';

export const POST = route<{ id: string }>({ admin: 'profiles.moderate' }, async ({ req, auth, params }) => { await trust.decideMedia(auth, params.id, await parseJson(req, trust.mediaDecisionSchema)); return { ok: true }; });
