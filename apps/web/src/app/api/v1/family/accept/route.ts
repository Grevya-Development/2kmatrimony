import { familyAcceptWithConsentSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { acceptInvite } from '@/server/family/service';

// Invitees may not have a matrimony profile of their own.
export const POST = route({ rateLimit: { name: 'family-accept', limit: 10, windowSec: 3600 } }, async ({ req, auth }) => {
  const { token, acceptTerms } = await parseJson(req, familyAcceptWithConsentSchema);
  return acceptInvite(auth, token, acceptTerms ?? false);
});
