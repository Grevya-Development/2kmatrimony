import { route } from '@/server/http';
import { visionThemes } from '@/server/connection-insights/service';

export const POST = route<{ id: string }>({ profile: 'required', rateLimit: { name: 'vision-themes', limit: 10, windowSec: 86400 } }, async ({ auth, params }) =>
  visionThemes(auth, params.id),
);
