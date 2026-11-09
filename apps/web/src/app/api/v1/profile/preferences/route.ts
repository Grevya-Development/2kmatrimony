import { partnerPreferencesSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { savePreferences } from '@/server/profile/service';

export const PUT = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, partnerPreferencesSchema);
  return { completion: await savePreferences(auth, input) };
});
