import { route, parseJson } from '@/server/http';
import * as ai from '@/server/admin/ai';

export const GET = route({ admin: 'ai.read' }, async () => ai.listPrompts());

export const POST = route({ admin: 'ai.configure' }, async ({ req, auth }) => ai.createPromptVersion(auth, await parseJson(req, ai.promptCreateSchema)));
