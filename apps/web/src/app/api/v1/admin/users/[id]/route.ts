import { route } from '@/server/http';
import * as users from '@/server/admin/users';

export const GET = route<{ id: string }>({ admin: 'users.read' }, async ({ params }) => users.getUserDetail(params.id));
