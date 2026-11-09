import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const POST = route({ admin: 'notifications.manage' }, async ({ req }) => platform.previewTemplate(await parseJson(req, platform.previewSchema)));
