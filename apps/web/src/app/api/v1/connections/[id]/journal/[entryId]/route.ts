import { journalEntrySchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { deleteJournal, updateJournal } from '@/server/connection-insights/service';

export const PATCH = route<{ id: string; entryId: string }>({ profile: 'required' }, async ({ req, auth, params }) =>
  updateJournal(auth, params.id, params.entryId, await parseJson(req, journalEntrySchema.partial())),
);

export const DELETE = route<{ id: string; entryId: string }>({ profile: 'required' }, async ({ auth, params }) => {
  await deleteJournal(auth, params.id, params.entryId);
  return { deleted: true };
});
