import { track } from '@/server/analytics/track';
import { interestListQuerySchema, sendInterestSchema } from '@2k/shared';
import { ok, parseJson, parseQuery, route } from '@/server/http';
import { listInterests, sendInterest } from '@/server/interests/service';

export const GET = route({ profile: 'required' }, async ({ req, auth }) => {
  const q = parseQuery(req, interestListQuerySchema);
  const { items, nextCursor } = await listInterests(auth, q);
  return ok(items, { nextCursor });
});

export const POST = route({ profile: 'active', rateLimit: { name: 'interest-burst', limit: 10, windowSec: 60 } }, async ({ req, auth }) => {
  const body = await parseJson(req, sendInterestSchema);
  const result = await sendInterest(auth, body.receiverProfileId, body.message);
  void track(auth.userId, 'interest_sent', { with_note: !!body.message }, auth.platform);
  return ok(result, { status: 201 });
});
