import { route } from '@/server/http';
import { getMatchExplanation } from '@/server/ai/features/explanation';

export const GET = route<{ id: string }>({ profile: 'required', rateLimit: { name: 'explanation', limit: 120, windowSec: 3600 } }, async ({ auth, params }) =>
  getMatchExplanation(auth, params.id),
);
