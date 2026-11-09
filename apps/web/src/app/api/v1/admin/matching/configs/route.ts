import { route, parseJson } from '@/server/http';
import * as matching from '@/server/admin/matching';

export const GET = route({ admin: 'matching.read' }, async ({ req }) => matching.listConfigs(new URL(req.url).searchParams.get('region') ?? 'default'));

export const POST = route({ admin: 'matching.configure' }, async ({ req, auth }) => matching.createConfig(auth, await parseJson(req, matching.configCreateSchema)));
