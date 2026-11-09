import { route, parseJson } from '@/server/http';
import * as matching from '@/server/admin/matching';

export const POST = route({ admin: 'matching.read' }, async ({ req }) => matching.testPair(await parseJson(req, matching.testPairSchema)));
