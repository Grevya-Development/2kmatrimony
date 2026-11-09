import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const GET = route({ admin: 'cms.manage' }, async ({ req }) => platform.listCms(req));

export const POST = route({ admin: 'cms.manage' }, async ({ req, auth }) => platform.createCms(auth, await parseJson(req, platform.cmsSchema)));
