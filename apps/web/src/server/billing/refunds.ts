import 'server-only';
// CONTRACT STUB — owned by workstream E, which replaces this with the Razorpay implementation.
import type { AuthContext } from '@/server/auth';
import { errors } from '@/server/http';

export async function processRefund(_refundId: string, _auth: AuthContext): Promise<void> {
  throw errors.unconfigured('Refund processing');
}
