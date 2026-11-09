import { track } from '@/server/analytics/track';
import { insightKindSchema } from '@2k/shared';
import { parseQuery, route } from '@/server/http';
import { generateInsight, latestInsight } from '@/server/connection-insights/service';

/** GET latest (or null) / POST generate a Gap Analysis or Before You Meet briefing. */
export const GET = route<{ id: string }>({ profile: 'required' }, async ({ req, auth, params }) => {
  const { kind } = parseQuery(req, insightKindSchema);
  return latestInsight(auth, params.id, kind);
});

export const POST = route<{ id: string }>({ profile: 'required', rateLimit: { name: 'insights', limit: 10, windowSec: 86400 } }, async ({ req, auth, params }) => {
  const { kind } = parseQuery(req, insightKindSchema);
  const out = await generateInsight(auth, params.id, kind);
  void track(auth.userId, 'insight_generated', { kind, generator: out.generator }, auth.platform);
  return out;
});
