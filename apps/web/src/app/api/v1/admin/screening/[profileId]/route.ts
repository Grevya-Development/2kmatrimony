import { parseJson, route } from '@/server/http';
import { decideScreening, screeningDecisionSchema } from '@/server/admin/curation';

/** Approve a profile (goes live) or request changes (back to the member with a note). */
export const POST = route<{ profileId: string }>({ admin: 'profiles.moderate' }, async ({ req, auth, params }) =>
  decideScreening(auth, params.profileId, await parseJson(req, screeningDecisionSchema)));
