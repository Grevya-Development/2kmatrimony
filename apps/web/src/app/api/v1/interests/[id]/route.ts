import { track } from '@/server/analytics/track';
import { respondInterestSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { respondInterest } from '@/server/interests/service';

export const POST = route<{ id: string }>({ profile: 'required' }, async ({ req, params, auth }) => {
  const { action } = await parseJson(req, respondInterestSchema);
  const out = await respondInterest(auth, params.id, action);
  void track(auth.userId, 'interest_responded', { action }, auth.platform);
  if (action === 'accept') void track(auth.userId, 'connection_created', { via: 'interest' }, auth.platform);
  return out;
});
