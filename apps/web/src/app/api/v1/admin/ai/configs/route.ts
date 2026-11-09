import { route } from '@/server/http';
import * as ai from '@/server/admin/ai';

export const GET = route({ admin: 'ai.read' }, async () => ai.listFeatureConfigs());
