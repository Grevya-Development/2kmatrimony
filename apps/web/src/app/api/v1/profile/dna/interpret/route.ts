import { dnaInterpretSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { interpretDna } from '@/server/profile/dna-ai';

export const POST = route({ profile: 'required', rateLimit: { name: 'dna-interpret', limit: 20, windowSec: 3600 } }, async ({ req, auth }) => {
  const input = await parseJson(req, dnaInterpretSchema);
  return interpretDna(auth, input.text, input.dimension);
});
