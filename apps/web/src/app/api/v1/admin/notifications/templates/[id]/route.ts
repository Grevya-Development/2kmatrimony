import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const PATCH = route<{ id: string }>({ admin: 'notifications.manage' }, async ({ req, auth, params }) => platform.updateTemplate(auth, params.id, await parseJson(req, platform.templateSchema.partial())));

export const DELETE = route<{ id: string }>({ admin: 'notifications.manage' }, async ({ auth, params }) => { await platform.deleteTemplate(auth, params.id); return { ok: true }; });
