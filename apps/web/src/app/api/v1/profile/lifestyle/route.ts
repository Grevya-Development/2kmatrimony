import { lifestyleSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { saveLifestyle } from '@/server/profile/service';

export const PUT = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, lifestyleSchema);
  return { completion: await saveLifestyle(auth, input) };
});
