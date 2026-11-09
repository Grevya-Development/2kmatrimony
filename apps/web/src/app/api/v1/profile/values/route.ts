import { valuesSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { saveValues } from '@/server/profile/service';

export const PUT = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, valuesSchema);
  return { completion: await saveValues(auth, input) };
});
