import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const PUT = route<{ key: string }>({ admin: 'settings.manage' }, async ({ req, auth, params }) => { await platform.updateSetting(auth, params.key, await parseJson(req, platform.settingSchema)); return { ok: true }; });
