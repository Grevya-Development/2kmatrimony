import { familySuggestionUpdateSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { updateSuggestion } from '@/server/family/service';

export const PATCH = route<{ id: string }>({ profile: 'required' }, async ({ req, auth, params }) => {
  const { status } = await parseJson(req, familySuggestionUpdateSchema);
  await updateSuggestion(auth, params.id, status);
  return { status };
});
