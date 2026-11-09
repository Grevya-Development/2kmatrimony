import { familySchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { saveFamily } from '@/server/profile/service';

export const PUT = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, familySchema);
  return { completion: await saveFamily(auth, input) };
});
