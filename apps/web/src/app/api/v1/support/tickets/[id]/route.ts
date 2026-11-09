import { route, parseJson } from '@/server/http';
import * as support from '@/server/support/service';
import { supportReplySchema } from '@2k/shared';

export const GET = route<{ id: string }>({ allowSuspended: true }, async ({ auth, params }) => support.getMyTicket(auth, params.id));

export const POST = route<{ id: string }>({ allowSuspended: true, rateLimit: { name: 'support-reply', limit: 30, windowSec: 3600 } }, async ({ req, auth, params }) => { const b = await parseJson(req, supportReplySchema); await support.memberReply(auth, params.id, b.body); return { ok: true }; });
