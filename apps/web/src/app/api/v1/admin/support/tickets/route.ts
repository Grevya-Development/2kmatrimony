import { route } from '@/server/http';
import * as support from '@/server/support/service';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'support.read' }, async ({ req, auth }) => support.listTicketsAdmin(req, parsePage(req), auth));
