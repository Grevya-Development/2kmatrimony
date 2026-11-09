import { confirmPhotoSchema } from '@2k/shared';
import { ok, parseJson, route } from '@/server/http';
import { confirmPhoto } from '@/server/profile/media';

export const POST = route({ profile: 'required', rateLimit: { name: 'photo-confirm', limit: 30, windowSec: 3600 } }, async ({ req, auth }) => {
  const input = await parseJson(req, confirmPhotoSchema);
  return ok(await confirmPhoto(auth, input), { status: 201 });
});
