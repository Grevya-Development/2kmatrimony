import { matchmakerApplySchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { applyFilters } from '@/server/ai/features/matchmaker';

/** Re-run the thread's search with member-edited filters (no AI call). */
export const POST = route<{ id: string }>({ profile: 'required', rateLimit: { name: 'matchmaker-apply', limit: 60, windowSec: 600 } }, async ({ req, auth, params }) => {
  const { filters, softPreferences } = await parseJson(req, matchmakerApplySchema);
  return applyFilters(auth, params.id, filters, softPreferences);
});
