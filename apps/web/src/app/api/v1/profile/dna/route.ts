import { dnaSaveSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { saveDna } from '@/server/profile/service';

export const PUT = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, dnaSaveSchema);
  return { completion: await saveDna(auth, input) };
});
