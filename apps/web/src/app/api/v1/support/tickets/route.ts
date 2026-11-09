import { route, parseJson } from '@/server/http';
import * as support from '@/server/support/service';
import { supportTicketSchema } from '@2k/shared';

export const GET = route({ allowSuspended: true }, async ({ auth }) => support.listMyTickets(auth));

export const POST = route({ allowSuspended: true, rateLimit: { name: 'support-ticket', limit: 10, windowSec: 3600 } }, async ({ req, auth }) => support.createTicket(auth, await parseJson(req, supportTicketSchema)));
