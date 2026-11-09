import { questionAnswersSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { saveAnswers } from '@/server/profile/questions';

export const POST = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, questionAnswersSchema);
  return { completion: await saveAnswers(auth, input) };
});
