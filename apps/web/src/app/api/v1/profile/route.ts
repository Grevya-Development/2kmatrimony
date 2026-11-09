import { profilePatchSchema, startProfileSchema } from '@2k/shared';
import { ok, parseJson, route } from '@/server/http';
import { getOwnProfile, setOnboardingStep, startProfile } from '@/server/profile/service';

export const GET = route({ profile: 'required', allowSuspended: true }, async ({ req, auth }) => {
  const preview = new URL(req.url).searchParams.get('preview') === '1';
  return getOwnProfile(auth, { preview });
});

export const POST = route({ rateLimit: { name: 'profile-start', limit: 10, windowSec: 3600 } }, async ({ req, auth }) => {
  const input = await parseJson(req, startProfileSchema);
  const result = await startProfile(auth, input);
  return ok(result, { status: result.created ? 201 : 200 });
});

export const PATCH = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, profilePatchSchema);
  return setOnboardingStep(auth, input.onboardingStep);
});
