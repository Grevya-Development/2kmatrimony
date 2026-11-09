import { familySuggestionCreateSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { createSuggestion, listSuggestionsForOwner } from '@/server/family/service';

export const GET = route({ profile: 'required' }, async ({ auth }) => listSuggestionsForOwner(auth));

export const POST = route({ rateLimit: { name: 'family-suggest', limit: 30, windowSec: 3600 } }, async ({ req, auth }) =>
  createSuggestion(auth, await parseJson(req, familySuggestionCreateSchema)),
);
