import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const PATCH = route<{ userId: string }>({ admin: 'admins.manage' }, async ({ req, auth, params }) => { await platform.updateAdmin(auth, params.userId, await parseJson(req, platform.adminUpdateSchema)); return { ok: true }; });
