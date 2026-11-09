import { familyInviteSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { requireFlag } from '@/server/config';
import { discussionTargets, inviteFamily, listFamily, listSuggestionsForOwner } from '@/server/family/service';

/** Owner view: members, suggestions inbox, discussed profiles. */
export const GET = route({ profile: 'required' }, async ({ auth }) => {
  await requireFlag('family_mode');
  const [members, suggestions, discussions] = await Promise.all([listFamily(auth), listSuggestionsForOwner(auth), discussionTargets(auth)]);
  return { members, suggestions, discussions };
});

export const POST = route({ profile: 'required', rateLimit: { name: 'family-invite', limit: 20, windowSec: 86400 } }, async ({ req, auth }) => {
  await requireFlag('family_mode');
  return inviteFamily(auth, await parseJson(req, familyInviteSchema));
});
