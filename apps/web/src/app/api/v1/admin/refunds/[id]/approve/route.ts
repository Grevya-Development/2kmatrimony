import { route } from '@/server/http';
import * as billing from '@/server/admin/billing';

export const POST = route<{ id: string }>({ admin: 'refunds.manage' }, async ({ auth, params }) => billing.approveRefund(auth, params.id));
