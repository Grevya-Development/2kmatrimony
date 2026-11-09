import { educationSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { saveEducation } from '@/server/profile/service';

export const PUT = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, educationSchema);
  return { completion: await saveEducation(auth, input) };
});
