import { smartSearchRequestSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { requireFlag } from '@/server/config';
import { interpretSmartSearch } from '@/server/ai/features/smart-search';

export const POST = route({ profile: 'active', rateLimit: { name: 'smart-search', limit: 30, windowSec: 600 } }, async ({ req, auth }) => {
  await requireFlag('smart_search');
  const { query } = await parseJson(req, smartSearchRequestSchema);
  return interpretSmartSearch(auth, query);
});
