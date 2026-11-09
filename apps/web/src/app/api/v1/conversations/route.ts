import { z } from 'zod';
import { parseQuery, route } from '@/server/http';
import { listConversations } from '@/server/messaging/service';

const query = z.object({ archived: z.enum(['0', '1']).default('0') });

export const GET = route({ profile: 'required' }, async ({ req, auth }) => {
  const { archived } = parseQuery(req, query);
  return listConversations(auth, archived === '1');
});
