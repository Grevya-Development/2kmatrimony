import { readinessNoteSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { requireFlag } from '@/server/config';
import { readinessState, saveReadinessNote } from '@/server/ai/features/readiness';

export const GET = route({ profile: 'required' }, async ({ auth }) => {
  await requireFlag('readiness_assistant');
  return readinessState(auth);
});

export const PUT = route({ profile: 'required' }, async ({ req, auth }) => {
  await requireFlag('readiness_assistant');
  return saveReadinessNote(auth, await parseJson(req, readinessNoteSchema));
});
