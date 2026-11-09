import { route } from '@/server/http';
import * as trust from '@/server/admin/trust';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'verification.review' }, async ({ req }) => trust.verificationQueue(req, parsePage(req)));
