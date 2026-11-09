import { route } from '@/server/http';
import { revokeDevice } from '@/server/profile/settings';

export const DELETE = route<{ id: string }>({ allowSuspended: true }, async ({ auth, params }) => revokeDevice(auth, params.id));
