import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const PATCH = route<{ id: string }>({ admin: 'roles.manage' }, async ({ req, auth, params }) => { await platform.updateRole(auth, params.id, await parseJson(req, platform.roleUpdateSchema)); return { ok: true }; });

export const DELETE = route<{ id: string }>({ admin: 'roles.manage' }, async ({ auth, params }) => { await platform.deleteRole(auth, params.id); return { ok: true }; });
