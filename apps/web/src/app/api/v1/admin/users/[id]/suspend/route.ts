import { route, parseJson } from '@/server/http';
import * as users from '@/server/admin/users';

export const POST = route<{ id: string }>({ admin: 'users.manage' }, async ({ req, auth, params }) => { await users.suspendUser(auth, params.id, await parseJson(req, users.suspendSchema)); return { ok: true }; });
