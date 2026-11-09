import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const GET = route({ admin: 'notifications.manage' }, async () => platform.listTemplates());

export const POST = route({ admin: 'notifications.manage' }, async ({ req, auth }) => platform.createTemplate(auth, await parseJson(req, platform.templateSchema)));
