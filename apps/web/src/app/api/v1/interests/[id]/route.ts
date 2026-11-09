import { respondInterestSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { respondInterest } from '@/server/interests/service';

export const POST = route<{ id: string }>({ profile: 'required' }, async ({ req, params, auth }) => {
  const { action } = await parseJson(req, respondInterestSchema);
  return respondInterest(auth, params.id, action);
});
