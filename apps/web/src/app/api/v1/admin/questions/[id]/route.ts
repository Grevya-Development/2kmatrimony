import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const PATCH = route<{ id: string }>({ admin: 'onboarding.manage' }, async ({ req, auth, params }) => platform.updateQuestion(auth, params.id, await parseJson(req, platform.questionPatchSchema)));

export const DELETE = route<{ id: string }>({ admin: 'onboarding.manage' }, async ({ auth, params }) => { await platform.deleteQuestion(auth, params.id); return { ok: true }; });
