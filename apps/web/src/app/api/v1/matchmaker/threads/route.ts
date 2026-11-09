import { route } from '@/server/http';
import { listThreads, matchmakerStatus } from '@/server/ai/features/matchmaker';

export const GET = route({ profile: 'required' }, async ({ auth }) => {
  const [threads, status] = await Promise.all([listThreads(auth), matchmakerStatus(auth)]);
  return { threads, status };
});
