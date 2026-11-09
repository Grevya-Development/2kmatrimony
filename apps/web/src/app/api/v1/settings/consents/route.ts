import { consentUpdateSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { getConsents, setConsent } from '@/server/profile/settings';

export const GET = route({ allowSuspended: true }, async ({ auth }) => getConsents(auth));
export const POST = route({ allowSuspended: true, rateLimit: { name: 'consents', limit: 60, windowSec: 3600 } }, async ({ req, auth }) => {
  const input = await parseJson(req, consentUpdateSchema);
  return setConsent(auth, input.consentType, input.granted);
});
