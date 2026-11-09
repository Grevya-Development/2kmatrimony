import { route } from '@/server/http';
import * as matching from '@/server/admin/matching';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'matching.read' }, async ({ req }) => matching.matchingStats(parseRange(req)));
