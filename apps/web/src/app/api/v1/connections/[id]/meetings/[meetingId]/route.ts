import { meetingPlanUpdateSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { updateMeeting } from '@/server/connection-insights/service';

export const PATCH = route<{ id: string; meetingId: string }>({}, async ({ req, auth, params }) => {
  const { status } = await parseJson(req, meetingPlanUpdateSchema);
  return updateMeeting(auth, params.id, params.meetingId, status);
});
