import { basicsSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { saveBasics } from '@/server/profile/service';

export const PUT = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, basicsSchema);
  return { completion: await saveBasics(auth, input) };
});
