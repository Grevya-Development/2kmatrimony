import { afterAll, describe, expect, it } from 'vitest';
import { POST as sendMessage } from '@/app/api/v1/conversations/[id]/messages/route';
import { createConnection } from '@/server/connections/service';
import { admin, call, request } from './helpers';
import { deleteUsers, seedMember, type SeededMember } from './discovery.fixtures';

/**
 * Regression: deleting an account that has a connection, conversation and
 * messages used to fail ("Database error deleting user") because a SET NULL
 * action re-checked FKs of rows being cascaded away. Fixed by deferring those
 * FK checks (migration 20261110000901).
 */
const created: SeededMember[] = [];
afterAll(async () => deleteUsers(created));

describe('account erasure with conversations', () => {
  it('deletes a connected member who has exchanged messages', async () => {
    const a = await seedMember({ label: 'erase-a', gender: 'female', seeking: 'male' });
    const b = await seedMember({ label: 'erase-b', gender: 'male', seeking: 'female' });
    created.push(b);
    const { conversationId } = await createConnection(a.profileId, b.profileId, null);
    for (const [u, body] of [[a, 'Hello!'], [b, 'Hi there']] as const) {
      const r = await call(sendMessage, request(`/api/v1/conversations/${conversationId}/messages`, { token: u.token, body: { clientId: `${u.userId.slice(0, 8)}-erase`, kind: 'text', body } }), { id: conversationId });
      expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    }

    const { error } = await admin().auth.admin.deleteUser(a.userId);
    expect(error).toBeNull();

    const { data: profile } = await admin().from('profiles').select('id').eq('id', a.profileId).maybeSingle();
    expect(profile).toBeNull();
    const { data: conv } = await admin().from('conversations').select('id').eq('id', conversationId).maybeSingle();
    expect(conv).toBeNull(); // connection + conversation cascade away with the deleted profile
    const { data: other } = await admin().from('profiles').select('id').eq('id', b.profileId).maybeSingle();
    expect(other?.id).toBe(b.profileId); // the other member is unaffected
  });
});
