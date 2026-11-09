import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const GET = route({ admin: 'roles.manage' }, async () => platform.listRoles());

export const POST = route({ admin: 'roles.manage' }, async ({ req, auth }) => platform.createRole(auth, await parseJson(req, platform.roleCreateSchema)));
