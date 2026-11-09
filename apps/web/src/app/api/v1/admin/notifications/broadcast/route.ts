import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const POST = route({ admin: 'notifications.manage', rateLimit: { name: 'admin-broadcast', limit: 10, windowSec: 3600 } }, async ({ req, auth }) => platform.broadcast(auth, await parseJson(req, platform.broadcastSchema)));
