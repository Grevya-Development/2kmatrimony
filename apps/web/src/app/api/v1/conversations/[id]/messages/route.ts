import { track } from '@/server/analytics/track';
import { z } from 'zod';
import { sendMessageSchema } from '@2k/shared';
import { ok, parseJson, parseQuery, route } from '@/server/http';
import { listMessages, sendMessage } from '@/server/messaging/service';

const query = z.object({ cursor: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(100).default(40) });

export const GET = route<{ id: string }>({ profile: 'required' }, async ({ req, params, auth }) => {
  const q = parseQuery(req, query);
  const { items, nextCursor, otherLastReadAt } = await listMessages(auth, params.id, q);
  return ok({ items, otherLastReadAt }, { nextCursor });
});

export const POST = route<{ id: string }>({ profile: 'active' }, async ({ req, params, auth }) => {
  const body = await parseJson(req, sendMessageSchema);
  const message = await sendMessage(auth, params.id, body);
  void track(auth.userId, 'message_sent', { kind: body.kind }, auth.platform);
  return ok(message, { status: 201 });
});
