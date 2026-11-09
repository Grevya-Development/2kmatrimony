import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const PATCH = route<{ key: string }>({ admin: 'feature_flags.manage' }, async ({ req, auth, params }) => { await platform.updateFlag(auth, params.key, await parseJson(req, platform.flagSchema)); return { ok: true }; });
