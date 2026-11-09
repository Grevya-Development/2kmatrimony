import { route } from '@/server/http';
import * as trust from '@/server/admin/trust';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'profiles.moderate' }, async ({ req }) => trust.mediaQueue(req, parsePage(req, 24)));
