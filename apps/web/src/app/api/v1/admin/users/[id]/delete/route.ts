import { route, parseJson } from '@/server/http';
import * as users from '@/server/admin/users';

export const POST = route<{ id: string }>({ admin: 'users.manage' }, async ({ req, auth, params }) => { const b = await parseJson(req, users.deleteUserSchema); return users.scheduleUserDeletion(auth, params.id, b.reason); });
