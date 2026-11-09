import { route } from '@/server/http';
import { listQuestions } from '@/server/profile/questions';

export const GET = route({}, async ({ req, auth }) => {
  const section = new URL(req.url).searchParams.get('section') ?? undefined;
  return listQuestions(auth, section);
});
