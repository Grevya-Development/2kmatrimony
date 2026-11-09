import { route, parseJson } from '@/server/http';
import * as platform from '@/server/admin/platform';

export const GET = route({ admin: 'onboarding.manage' }, async () => platform.listQuestions());

export const POST = route({ admin: 'onboarding.manage' }, async ({ req, auth }) => platform.createQuestion(auth, await parseJson(req, platform.questionSchema)));
