import { confirmVideoSchema } from '@2k/shared';
import { ok, parseJson, route } from '@/server/http';
import { requireFlag } from '@/server/config';
import { confirmVideo, deleteVideo } from '@/server/profile/media';

export const POST = route({ profile: 'required', rateLimit: { name: 'video-confirm', limit: 10, windowSec: 3600 } }, async ({ req, auth }) => {
  await requireFlag('video_intros');
  const input = await parseJson(req, confirmVideoSchema);
  return ok(await confirmVideo(auth, input), { status: 201 });
});

export const DELETE = route({ profile: 'required' }, async ({ auth }) => deleteVideo(auth));
