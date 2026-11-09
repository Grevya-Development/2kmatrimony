import { route } from '@/server/http';
import * as ai from '@/server/admin/ai';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'ai.read' }, async ({ req }) => ai.aiUsage(parseRange(req)));
