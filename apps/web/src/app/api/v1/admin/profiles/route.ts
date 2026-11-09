import { route } from '@/server/http';
import * as trust from '@/server/admin/trust';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'profiles.read' }, async ({ req }) => trust.listProfiles(req, parsePage(req)));
