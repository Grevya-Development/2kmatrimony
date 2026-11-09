import { route } from '@/server/http';
import * as users from '@/server/admin/users';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'users.read' }, async ({ req }) => users.listUsers(req, parsePage(req)));
