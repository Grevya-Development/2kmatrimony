import { route } from '@/server/http';
import { buildMe, touchActivity } from '@/server/me';

export const GET = route({ allowSuspended: true }, async ({ auth }) => {
  await touchActivity(auth);
  return buildMe(auth);
});
