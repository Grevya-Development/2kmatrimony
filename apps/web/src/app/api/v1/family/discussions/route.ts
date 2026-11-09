import { z } from 'zod';
import { familyDiscussionCreateSchema } from '@2k/shared';
import { errors, parseJson, parseQuery, route } from '@/server/http';
import { addDiscussion, listDiscussions } from '@/server/family/service';

const query = z.object({ profileId: z.uuid().optional(), targetProfileId: z.uuid() });

/** profileId defaults to the caller's own profile (owner); family members pass the owner's profileId. */
export const GET = route({}, async ({ req, auth }) => {
  const q = parseQuery(req, query);
  const profileId = q.profileId ?? auth.profile?.id;
  if (!profileId) throw errors.validation('profileId is required.');
  return listDiscussions(auth, profileId, q.targetProfileId);
});

export const POST = route({ rateLimit: { name: 'family-discuss', limit: 120, windowSec: 3600 } }, async ({ req, auth }) => {
  const body = await parseJson(req, familyDiscussionCreateSchema);
  const profileId = body.profileId ?? auth.profile?.id;
  if (!profileId) throw errors.validation('profileId is required.');
  return addDiscussion(auth, profileId, body.targetProfileId, body.body);
});
