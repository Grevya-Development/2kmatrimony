import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const PATCH = route<{ code: string }>({ admin: 'regions.manage' }, async ({ req, auth, params }) => { await platform.updateLanguage(auth, params.code, await parseJson(req, platform.languageSchema)); return { ok: true }; });
