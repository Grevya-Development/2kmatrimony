import { route } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const GET = route({ admin: 'settings.manage' }, async () => platform.systemStatus());
