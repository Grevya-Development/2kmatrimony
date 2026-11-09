import { route } from '@/server/http';
import * as platform from '@/server/admin/platform';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'audit.read' }, async ({ req }) => platform.listAudit(req, parsePage(req, 50)));
