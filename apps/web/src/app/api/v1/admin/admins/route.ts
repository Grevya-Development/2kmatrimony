import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const GET = route({ admin: 'admins.manage' }, async () => platform.listAdmins());

export const POST = route({ admin: 'admins.manage' }, async ({ req, auth }) => platform.inviteAdmin(auth, await parseJson(req, platform.adminInviteSchema)));
