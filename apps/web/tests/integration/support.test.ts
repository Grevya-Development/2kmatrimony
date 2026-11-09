import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as myTickets, POST as createTicket } from '@/app/api/v1/support/tickets/route';
import { GET as myTicket, POST as memberReply } from '@/app/api/v1/support/tickets/[id]/route';
import { GET as adminTickets } from '@/app/api/v1/admin/support/tickets/route';
import { GET as adminTicket, PATCH as adminPatch, POST as staffReply } from '@/app/api/v1/admin/support/tickets/[id]/route';
import { admin, call, createTestUser, request, type TestUser } from './helpers';
import { createAdmin, createMember, deleteUsers } from './admin-helpers';

let member: Awaited<ReturnType<typeof createMember>>;
let other: TestUser;
let staff: TestUser;
let ticketId: string;

beforeAll(async () => {
  member = await createMember('itsupport');
  other = await createTestUser('itsupport-other');
  staff = await createAdmin('itsupport-staff', 'support');
});

afterAll(async () => {
  await deleteUsers([member.userId, other.userId, staff.userId]);
});

describe('support tickets', () => {
  it('member creates and lists a ticket; validation enforced', async () => {
    expect((await call(createTicket, request('/', { token: member.token, body: { category: 'billing', subject: 'x', body: '' } }))).status).toBe(422);
    const r = await call<{ id: string; status: string }>(createTicket, request('/', { token: member.token, body: { category: 'billing', subject: 'Charged twice', body: 'I was charged twice for Plus.' } }));
    expect(r.status).toBe(200);
    expect(r.body.data?.status).toBe('open');
    ticketId = r.body.data!.id;
    const list = await call<{ id: string }[]>(myTickets, request('/', { token: member.token }));
    expect(list.body.data?.map((t) => t.id)).toContain(ticketId);
  });

  it('another member cannot read the ticket', async () => {
    expect((await call(myTicket, request('/', { token: other.token }), { id: ticketId })).status).toBe(404);
    expect((await call(memberReply, request('/', { token: other.token, body: { body: 'hi' } }), { id: ticketId })).status).toBe(404);
  });

  it('staff sees it in the queue, assigns, replies and adds an internal note', async () => {
    const q = await call<{ items: { id: string }[] }>(adminTickets, request('/api/v1/admin/support/tickets?status=active&limit=100', { token: staff.token }));
    expect(q.body.data?.items.some((t) => t.id === ticketId)).toBe(true);
    expect((await call(adminPatch, request('/', { token: staff.token, method: 'PATCH', body: { assignToMe: true, priority: 'high' } }), { id: ticketId })).status).toBe(200);
    expect((await call(staffReply, request('/', { token: staff.token, body: { body: 'We are refunding the duplicate charge.' } }), { id: ticketId })).status).toBe(200);
    expect((await call(staffReply, request('/', { token: staff.token, body: { body: 'Internal: verified duplicate in Razorpay.', internal: true } }), { id: ticketId })).status).toBe(200);
    const t = await call<{ ticket: { status: string; assigned_to: string }; messages: { is_internal_note: boolean }[] }>(adminTicket, request('/', { token: staff.token }), { id: ticketId });
    expect(t.body.data?.ticket.status).toBe('pending_user');
    expect(t.body.data?.ticket.assigned_to).toBe(staff.userId);
    expect(t.body.data?.messages.filter((m) => m.is_internal_note).length).toBe(1);
    const { data: n } = await admin().from('notifications').select('type').eq('user_id', member.userId).eq('type', 'support_reply');
    expect(n?.length).toBe(1);
  });

  it('member never sees internal notes and replying reopens the ticket', async () => {
    const t = await call<{ messages: { body: string; is_staff: boolean }[] }>(myTicket, request('/', { token: member.token }), { id: ticketId });
    expect(t.body.data?.messages.length).toBe(2);
    expect(t.body.data?.messages.some((m) => m.body.startsWith('Internal'))).toBe(false);
    await call(memberReply, request('/', { token: member.token, body: { body: 'Thank you!' } }), { id: ticketId });
    const { data } = await admin().from('support_tickets').select('status').eq('id', ticketId).single();
    expect(data?.status).toBe('open');
  });

  it('suspended members can still contact support', async () => {
    await admin().from('app_users').update({ status: 'suspended' }).eq('id', member.userId);
    const r = await call(myTickets, request('/', { token: member.token }));
    expect(r.status).toBe(200);
    await admin().from('app_users').update({ status: 'active' }).eq('id', member.userId);
  });

  it('non-staff cannot use the admin queue', async () => {
    expect((await call(adminTickets, request('/', { token: member.token }))).status).toBe(403);
  });
});
