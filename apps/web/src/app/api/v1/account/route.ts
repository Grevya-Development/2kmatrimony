import { accountUpdateSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { updateAccount } from '@/server/profile/settings';

export const PATCH = route({ allowSuspended: true }, async ({ req, auth }) => updateAccount(auth, await parseJson(req, accountUpdateSchema)));
