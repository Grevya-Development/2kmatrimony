import { meetingPlanSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { listMeetings, proposeMeeting } from '@/server/connection-insights/service';

// Accessible to connection members and to family members holding `coordinate_meetings`
// (family members may not have a profile of their own, so no profile requirement).
export const GET = route<{ id: string }>({}, async ({ auth, params }) => listMeetings(auth, params.id));

export const POST = route<{ id: string }>({ rateLimit: { name: 'meetings', limit: 30, windowSec: 3600 } }, async ({ req, auth, params }) =>
  proposeMeeting(auth, params.id, await parseJson(req, meetingPlanSchema)),
);
