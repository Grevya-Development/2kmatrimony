import { route, parseJson } from '@/server/http';
import * as support from '@/server/support/service';

export const GET = route<{ id: string }>({ admin: 'support.read' }, async ({ params }) => support.getTicketAdmin(params.id));

export const PATCH = route<{ id: string }>({ admin: 'support.respond' }, async ({ req, auth, params }) => { await support.updateTicketAdmin(auth, params.id, await parseJson(req, support.ticketUpdateSchema)); return { ok: true }; });

export const POST = route<{ id: string }>({ admin: 'support.respond' }, async ({ req, auth, params }) => { await support.staffReply(auth, params.id, await parseJson(req, support.staffReplySchema)); return { ok: true }; });
