import { conversationUpdateSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { getConversation, updateParticipant } from '@/server/messaging/service';

export const GET = route<{ id: string }>({ profile: 'required' }, async ({ params, auth }) => getConversation(auth, params.id));

export const PATCH = route<{ id: string }>({ profile: 'required' }, async ({ req, params, auth }) => {
  const body = await parseJson(req, conversationUpdateSchema);
  return updateParticipant(auth, params.id, body);
});
