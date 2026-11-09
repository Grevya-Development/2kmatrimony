import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const PATCH = route<{ code: string }>({ admin: 'regions.manage' }, async ({ req, auth, params }) => { await platform.updateRegion(auth, params.code, await parseJson(req, platform.regionSchema)); return { ok: true }; });
