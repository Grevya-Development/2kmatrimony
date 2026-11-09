import { visionItemUpdateSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { deleteVision, updateVision } from '@/server/connection-insights/service';

export const PATCH = route<{ id: string; itemId: string }>({ profile: 'required' }, async ({ req, auth, params }) =>
  updateVision(auth, params.id, params.itemId, await parseJson(req, visionItemUpdateSchema)),
);

export const DELETE = route<{ id: string; itemId: string }>({ profile: 'required' }, async ({ auth, params }) => {
  await deleteVision(auth, params.id, params.itemId);
  return { deleted: true };
});
