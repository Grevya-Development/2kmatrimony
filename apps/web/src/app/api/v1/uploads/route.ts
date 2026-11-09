import { profileUploadSchema } from '@2k/shared';
import { ok, parseJson, route } from '@/server/http';
import { requestUpload } from '@/server/profile/media';

/** Signed upload URLs for profile photos, intro video and verification documents. Chat media uses B's endpoint. */
export const POST = route({ profile: 'required', rateLimit: { name: 'uploads', limit: 40, windowSec: 3600 } }, async ({ req, auth }) => {
  const input = await parseJson(req, profileUploadSchema);
  return ok(await requestUpload(auth, input.kind, input.contentType, input.sizeBytes), { status: 201 });
});
