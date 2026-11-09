import { track } from '@/server/analytics/track';
import { searchWithPreferencesSchema } from '@2k/shared';
import { ok, parseJson, route } from '@/server/http';
import { getPlanState } from '@/server/entitlements';
import { assertFilterEntitlements, searchProfiles } from '@/server/search/service';
import { viewerBundle } from '@/server/discovery/cards';

/** Filtered search with compatibility ranking. Advanced filters require Plus+. */
export const POST = route({ profile: 'active', rateLimit: { name: 'search', limit: 60, windowSec: 60 } }, async ({ req, auth }) => {
  const { softPreferences, ...body } = await parseJson(req, searchWithPreferencesSchema);
  const plan = await getPlanState(auth.userId);
  assertFilterEntitlements(body.filters, plan.entitlements);
  const viewer = await viewerBundle(auth.profile!.id);
  const result = await searchProfiles(viewer, body, { softPreferences });
  void track(auth.userId, 'search_performed', { sort: body.sort, filter_count: Object.values(body.filters).filter((v) => v !== undefined && !(Array.isArray(v) && v.length === 0)).length, results: result.total, paged: !!body.cursor }, auth.platform);
  return ok({ items: result.items, total: result.total }, { nextCursor: result.nextCursor });
});
