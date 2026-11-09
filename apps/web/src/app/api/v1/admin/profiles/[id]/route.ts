import { route, parseJson } from '@/server/http';
import * as trust from '@/server/admin/trust';

export const GET = route<{ id: string }>({ admin: 'profiles.read' }, async ({ params }) => trust.getAdminProfile(params.id));

export const PATCH = route<{ id: string }>({ admin: 'profiles.moderate' }, async ({ req, auth, params }) => { await trust.setProfileHidden(auth, params.id, await parseJson(req, trust.profileVisibilitySchema)); return { ok: true }; });
