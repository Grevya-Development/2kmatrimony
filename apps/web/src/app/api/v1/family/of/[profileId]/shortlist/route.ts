import { familyShortlistSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { familyShortlist } from '@/server/family/service';

export const POST = route<{ profileId: string }>({ rateLimit: { name: 'family-shortlist', limit: 60, windowSec: 3600 } }, async ({ req, auth, params }) => {
  const { targetProfileId, note } = await parseJson(req, familyShortlistSchema);
  await familyShortlist(auth, params.profileId, targetProfileId, note);
  return { shortlisted: true };
});
