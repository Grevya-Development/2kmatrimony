import { route } from '@/server/http';
import { deleteThread, getThread } from '@/server/ai/features/matchmaker';

export const GET = route<{ id: string }>({ profile: 'required' }, async ({ auth, params }) => getThread(auth, params.id));

export const DELETE = route<{ id: string }>({ profile: 'required' }, async ({ auth, params }) => {
  await deleteThread(auth, params.id);
  return { deleted: true };
});
