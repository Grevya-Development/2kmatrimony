import { visionItemSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { requireFlag } from '@/server/config';
import { addVision, latestInsight, listVision } from '@/server/connection-insights/service';

export const GET = route<{ id: string }>({ profile: 'required' }, async ({ auth, params }) => {
  await requireFlag('vision_board');
  const [items, themes] = await Promise.all([listVision(auth, params.id), latestInsight(auth, params.id, 'vision_themes')]);
  return { items, themes };
});

export const POST = route<{ id: string }>({ profile: 'required', rateLimit: { name: 'vision', limit: 60, windowSec: 3600 } }, async ({ req, auth, params }) => {
  await requireFlag('vision_board');
  return addVision(auth, params.id, await parseJson(req, visionItemSchema));
});
