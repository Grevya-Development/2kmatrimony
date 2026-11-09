import { route } from '@/server/http';
import * as matching from '@/server/admin/matching';

export const POST = route<{ id: string }>({ admin: 'matching.configure' }, async ({ auth, params }) => { await matching.activateConfig(auth, params.id); return { ok: true }; });
