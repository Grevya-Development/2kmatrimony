import { route, parseJson } from '@/server/http';
import * as trust from '@/server/admin/trust';
import { parsePage, parseRange } from '@/server/admin/common';

export const GET = route({ admin: 'reports.manage' }, async ({ req }) => trust.listModerationActions(req, parsePage(req)));

export const POST = route({ admin: 'moderation.act' }, async ({ req, auth }) => { await trust.takeModerationAction(auth, await parseJson(req, trust.moderationActionSchema)); return { ok: true }; });
