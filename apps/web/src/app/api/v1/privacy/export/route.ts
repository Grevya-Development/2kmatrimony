import { ok, route } from '@/server/http';
import { requestExport } from '@/server/privacy/export';

export const POST = route({ allowSuspended: true }, async ({ auth }) => ok(await requestExport(auth), { status: 201 }));
