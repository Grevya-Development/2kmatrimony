import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const PATCH = route<{ id: string }>({ admin: 'cms.manage' }, async ({ req, auth, params }) => platform.updateCms(auth, params.id, await parseJson(req, platform.cmsSchema.partial())));

export const DELETE = route<{ id: string }>({ admin: 'cms.manage' }, async ({ auth, params }) => { await platform.deleteCms(auth, params.id); return { ok: true }; });
