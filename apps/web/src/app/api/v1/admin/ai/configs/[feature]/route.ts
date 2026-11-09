import { route, parseJson } from '@/server/http';
import * as ai from '@/server/admin/ai';

export const PATCH = route<{ feature: string }>({ admin: 'ai.configure' }, async ({ req, auth, params }) => { await ai.updateFeatureConfig(auth, params.feature, await parseJson(req, ai.featureConfigSchema)); return { ok: true }; });
