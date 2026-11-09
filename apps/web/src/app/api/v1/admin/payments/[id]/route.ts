import { route } from '@/server/http';
import * as billing from '@/server/admin/billing';

export const GET = route<{ id: string }>({ admin: 'payments.read' }, async ({ params }) => billing.getPayment(params.id));
