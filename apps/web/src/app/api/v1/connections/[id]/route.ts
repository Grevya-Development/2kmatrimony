import { route } from '@/server/http';
import { connectionOverview } from '@/server/connection-insights/service';

export const GET = route<{ id: string }>({ profile: 'required' }, async ({ auth, params }) => connectionOverview(auth, params.id));
