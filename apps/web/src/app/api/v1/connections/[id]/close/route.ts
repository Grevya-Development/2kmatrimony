import { closeConnectionSchema } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { audit } from '@/server/audit';
import { errors, parseJson, route } from '@/server/http';
import { getMemberConnection } from '@/server/connections/service';

/** Close a connection respectfully; the conversation becomes read-only. */
export const POST = route<{ id: string }>({ profile: 'required' }, async ({ req, params, auth }) => {
  const { reason } = await parseJson(req, closeConnectionSchema);
  const me = auth.profile!;
  const conn = await getMemberConnection(params.id, me.id);
  if (conn.status !== 'active') throw errors.conflict('This connection is already closed.');
  await db().from('connections').update({ status: 'closed', closed_by_profile_id: me.id, closed_reason: reason, closed_at: new Date().toISOString() }).eq('id', conn.id).eq('status', 'active');
  const { data: conv } = await db().from('conversations').update({ is_locked: true }).eq('connection_id', conn.id).select('id').maybeSingle();
  if (conv) await db().from('messages').insert({ conversation_id: conv.id, kind: 'system', body: 'This connection has been closed. The conversation is now read-only.' });
  await audit(auth, { action: 'connection.close', entityType: 'connection', entityId: conn.id });
  return { status: 'closed' };
});
