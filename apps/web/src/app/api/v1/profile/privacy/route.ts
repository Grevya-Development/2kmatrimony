import { privacySchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { savePrivacy } from '@/server/profile/service';

export const PUT = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, privacySchema);
  return { completion: await savePrivacy(auth, input) };
});
