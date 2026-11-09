import { matchmakerMessageSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { requireFlag } from '@/server/config';
import { prepareTurn } from '@/server/ai/features/matchmaker';

/**
 * POST /matchmaker — one conversational turn.
 * Response: text/plain stream of the assistant's reply. Headers: x-thread-id.
 * The structured payload (intent, filters, soft preferences, clarifying
 * questions, result profiles) is persisted on the assistant message; fetch it
 * with GET /matchmaker/threads/{x-thread-id} once the stream ends.
 * Errors before streaming (quota, consent, validation) return JSON as usual.
 */
export const POST = route({ profile: 'active', rateLimit: { name: 'matchmaker', limit: 30, windowSec: 600 } }, async ({ req, auth }) => {
  await requireFlag('ai_matchmaker');
  const body = await parseJson(req, matchmakerMessageSchema);
  const turn = await prepareTurn(auth, body);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const { reply } = await turn.run();
        // Deliver in small chunks so clients can render progressively.
        const words = reply.split(/(\s+)/);
        for (let i = 0; i < words.length; i += 6) {
          controller.enqueue(encoder.encode(words.slice(i, i + 6).join('')));
          await new Promise((r) => setTimeout(r, 12));
        }
      } catch (err) {
        console.error('[matchmaker] turn failed', err);
        controller.enqueue(encoder.encode('Sorry — something went wrong while searching. Please try again.'));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-thread-id': turn.threadId, 'x-content-type-options': 'nosniff' },
  });
});
