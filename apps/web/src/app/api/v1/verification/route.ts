import { verificationSubmitSchema } from '@2k/shared';
import { ok, parseJson, route } from '@/server/http';
import { listVerifications, submitVerification } from '@/server/profile/verification';

export const GET = route({ profile: 'required' }, async ({ auth }) => listVerifications(auth));

export const POST = route({ profile: 'required', rateLimit: { name: 'verification-submit', limit: 10, windowSec: 86400 } }, async ({ req, auth }) => {
  const input = await parseJson(req, verificationSubmitSchema);
  return ok(await submitVerification(auth, input), { status: 201 });
});
