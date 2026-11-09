import { route } from '@/server/http';
import { listDataRequests } from '@/server/privacy/export';

export const GET = route({ allowSuspended: true }, async ({ auth }) => listDataRequests(auth));
