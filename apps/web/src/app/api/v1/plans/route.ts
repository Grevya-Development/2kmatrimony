import { route } from '@/server/http';
import { listPlans } from '@/server/billing/plans';

/** Public plan catalogue (prices are GST-inclusive). */
export const GET = route({ auth: 'none' }, async () => listPlans());
