import { route, parseJson } from '@/server/http';
import * as users from '@/server/admin/users';

export const POST = route<{ id: string }>({ admin: 'subscriptions.manage' }, async ({ req, auth, params }) => users.manageSubscription(auth, params.id, await parseJson(req, users.subscriptionActionSchema)));
