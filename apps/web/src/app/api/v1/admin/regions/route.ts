import { route } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const GET = route({ admin: 'regions.manage' }, async () => platform.listRegionsAndLanguages());
