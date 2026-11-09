import { route } from '@/server/http';
import * as trust from '@/server/admin/trust';

export const GET = route<{ id: string }>({ admin: 'verification.review' }, async ({ auth, params }) => trust.getVerification(auth, params.id));
