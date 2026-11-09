import { route, parseJson } from '@/server/http';
import * as ai from '@/server/admin/ai';

export const PATCH = route<{ id: string }>({ admin: 'ai.configure' }, async ({ req, auth, params }) => { const b = await parseJson(req, ai.promptToggleSchema); await ai.setPromptActive(auth, params.id, b.isActive); return { ok: true }; });
