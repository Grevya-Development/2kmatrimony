import { journalEntrySchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { requireFlag } from '@/server/config';
import { addJournal, listJournal } from '@/server/connection-insights/service';

export const GET = route<{ id: string }>({ profile: 'required' }, async ({ auth, params }) => {
  await requireFlag('compatibility_journal');
  return listJournal(auth, params.id);
});

export const POST = route<{ id: string }>({ profile: 'required', rateLimit: { name: 'journal', limit: 100, windowSec: 3600 } }, async ({ req, auth, params }) => {
  await requireFlag('compatibility_journal');
  return addJournal(auth, params.id, await parseJson(req, journalEntrySchema));
});
