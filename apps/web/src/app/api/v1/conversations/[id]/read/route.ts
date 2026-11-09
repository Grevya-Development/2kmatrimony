import { route } from '@/server/http';
import { markRead } from '@/server/messaging/service';

export const POST = route<{ id: string }>({ profile: 'required' }, async ({ params, auth }) => markRead(auth, params.id));
