import { route } from '@/server/http';
import * as users from '@/server/admin/users';

export const GET = route<{ id: string }>({ admin: 'sensitive_data.read' }, async ({ auth, params }) => users.revealContact(auth, params.id));
