import { track } from '@/server/analytics/track';
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
  if (result.created) void track(auth.userId, 'signed_up', { created_for: input.createdFor, ai_consent: input.consents.aiProcessing }, auth.platform);
  return ok(result, { status: result.created ? 201 : 200 });
});

export const PATCH = route({ profile: 'required' }, async ({ req, auth }) => {
  const input = await parseJson(req, profilePatchSchema);
  const out = await setOnboardingStep(auth, input.onboardingStep);
  void track(auth.userId, 'onboarding_step_completed', { step: input.onboardingStep }, auth.platform);
  return out;
});
