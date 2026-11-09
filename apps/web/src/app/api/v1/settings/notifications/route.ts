import { notificationPreferencesSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { getNotificationPreferences, setNotificationPreferences } from '@/server/profile/settings';

export const GET = route({ allowSuspended: true }, async ({ auth }) => getNotificationPreferences(auth));
export const PUT = route({ allowSuspended: true }, async ({ req, auth }) => {
  const input = await parseJson(req, notificationPreferencesSchema);
  return setNotificationPreferences(auth, input.preferences);
});
