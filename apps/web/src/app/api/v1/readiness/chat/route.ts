import { readinessChatQuerySchema, readinessMessageSchema } from '@2k/shared';
import { parseJson, parseQuery, route } from '@/server/http';
import { requireFlag } from '@/server/config';
import { readinessChat, readinessHistory } from '@/server/ai/features/readiness';

/** GET ?topic= → this topic's private discussion history. */
export const GET = route({ profile: 'required' }, async ({ req, auth }) => {
  const { topic } = parseQuery(req, readinessChatQuerySchema);
  return readinessHistory(auth, topic);
});

/** POST → text/plain stream of the assistant's reply (persisted on completion). */
export const POST = route({ profile: 'required', rateLimit: { name: 'readiness-chat', limit: 30, windowSec: 3600 } }, async ({ req, auth }) => {
  await requireFlag('readiness_assistant');
  const { topic, message } = await parseJson(req, readinessMessageSchema);
  const stream = await readinessChat(auth, topic, message);
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
});
