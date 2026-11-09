import { route } from '@/server/http';
import { billingHistory } from '@/server/billing/history';

export const GET = route({ allowSuspended: true }, async ({ auth }) => billingHistory(auth.userId));
