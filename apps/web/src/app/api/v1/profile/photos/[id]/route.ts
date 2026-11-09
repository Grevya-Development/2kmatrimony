import { updatePhotoSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { deletePhoto, updatePhoto } from '@/server/profile/media';

export const PATCH = route<{ id: string }>({ profile: 'required' }, async ({ req, auth, params }) => {
  const input = await parseJson(req, updatePhotoSchema);
  return updatePhoto(auth, params.id, input);
});

export const DELETE = route<{ id: string }>({ profile: 'required' }, async ({ auth, params }) => deletePhoto(auth, params.id));
