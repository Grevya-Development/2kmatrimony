import { route } from '@/server/http';
import { memberView } from '@/server/family/service';

export const GET = route<{ profileId: string }>({}, async ({ auth, params }) => memberView(auth, params.profileId));
