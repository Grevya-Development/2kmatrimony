import { registerDeviceSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { listDevices, registerDevice } from '@/server/profile/settings';

export const GET = route({ allowSuspended: true }, async ({ auth }) => listDevices(auth));
export const POST = route({ allowSuspended: true, rateLimit: { name: 'devices', limit: 30, windowSec: 3600 } }, async ({ req, auth }) => registerDevice(auth, await parseJson(req, registerDeviceSchema)));
