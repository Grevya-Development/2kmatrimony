import { careerSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { saveCareer } from '@/server/profile/service';

export const PUT = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, careerSchema);
  return { completion: await saveCareer(auth, input) };
});
