import { route, parseJson } from '@/server/http';
import * as users from '@/server/admin/users';
import { z } from 'zod';

export const POST = route<{ id: string }>({ admin: 'users.manage' }, async ({ req, auth, params }) => { const b = await parseJson(req, z.object({ reason: z.string().trim().min(5).max(1000) })); await users.reactivateUser(auth, params.id, b.reason); return { ok: true }; });
