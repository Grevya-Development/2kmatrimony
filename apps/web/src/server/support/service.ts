import 'server-only';
import { z } from 'zod';
import type { Database, supportTicketSchema } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { errors } from '@/server/http';
import { notify } from '@/server/notify';
import { paged, qp, type Page } from '@/server/admin/common';

// ---------------------------------------------------------------------------
// Member side
// ---------------------------------------------------------------------------
export async function createTicket(auth: AuthContext, input: z.infer<typeof supportTicketSchema>) {
  const c = db();
  const { data: ticket, error } = await c
    .from('support_tickets')
    .insert({ user_id: auth.userId, contact_email: auth.email, category: input.category, subject: input.subject, priority: input.category === 'safety' ? 'high' : 'normal' })
    .select('id, subject, category, status, priority, created_at, updated_at')
    .single();
  if (error) throw error;
  await c.from('support_messages').insert({ ticket_id: ticket.id, author_user_id: auth.userId, is_staff: false, body: input.body });
  return ticket;
}

export async function listMyTickets(auth: AuthContext) {
  const { data, error } = await db().from('support_tickets').select('id, subject, category, status, priority, created_at, updated_at').eq('user_id', auth.userId).order('updated_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getMyTicket(auth: AuthContext, id: string) {
  const c = db();
  const { data: ticket } = await c.from('support_tickets').select('id, subject, category, status, priority, created_at, updated_at, user_id').eq('id', id).maybeSingle();
  if (!ticket || ticket.user_id !== auth.userId) throw errors.notFound('Ticket not found.');
  const { data: messages } = await c.from('support_messages').select('id, body, is_staff, created_at, author_user_id').eq('ticket_id', id).eq('is_internal_note', false).order('created_at');
  const { user_id: _u, ...rest } = ticket;
  return { ticket: rest, messages: (messages ?? []).map(({ author_user_id: _a, ...m }) => m) };
}

export async function memberReply(auth: AuthContext, id: string, body: string) {
  const c = db();
  const { data: ticket } = await c.from('support_tickets').select('id, user_id, status').eq('id', id).maybeSingle();
  if (!ticket || ticket.user_id !== auth.userId) throw errors.notFound('Ticket not found.');
  if (ticket.status === 'closed') throw errors.conflict('This ticket is closed. Please open a new request.');
  await c.from('support_messages').insert({ ticket_id: id, author_user_id: auth.userId, is_staff: false, body });
  await c.from('support_tickets').update({ status: 'open' }).eq('id', id);
}

// ---------------------------------------------------------------------------
// Staff side
// ---------------------------------------------------------------------------
export async function listTicketsAdmin(req: Request, p: Page, auth: AuthContext) {
  const status = qp(req, 'status') ?? 'active';
  const category = qp(req, 'category');
  const mine = qp(req, 'mine') === 'true';
  let query = db().from('support_tickets').select('id, subject, category, status, priority, assigned_to, user_id, created_at, updated_at', { count: 'exact' }).order('updated_at', { ascending: false }).range(p.offset, p.offset + p.limit - 1);
  if (status === 'active') query = query.in('status', ['open', 'pending_user']);
  else if (status !== 'all') query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (mine) query = query.eq('assigned_to', auth.userId);
  const { data, count, error } = await query;
  if (error) throw error;
  return paged((data ?? []).map((t) => ({ ...t, assignedToMe: t.assigned_to === auth.userId })), count, p);
}

export async function getTicketAdmin(id: string) {
  const c = db();
  const { data: ticket } = await c.from('support_tickets').select('*').eq('id', id).maybeSingle();
  if (!ticket) throw errors.notFound('Ticket not found.');
  const [{ data: messages }, { data: profile }, { data: user }] = await Promise.all([
    c.from('support_messages').select('id, body, is_staff, is_internal_note, author_user_id, created_at').eq('ticket_id', id).order('created_at'),
    ticket.user_id ? c.from('profiles').select('id, profile_code, first_name').eq('owner_user_id', ticket.user_id).maybeSingle() : Promise.resolve({ data: null }),
    ticket.user_id ? c.from('app_users').select('id, full_name, status').eq('id', ticket.user_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { ticket: { ...ticket, contact_email: null }, messages: messages ?? [], member: user ? { ...user, profile } : null };
}

export const ticketUpdateSchema = z.object({
  status: z.enum(['open', 'pending_user', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignToMe: z.boolean().optional(),
  unassign: z.boolean().optional(),
});
export const staffReplySchema = z.object({ body: z.string().trim().min(1).max(5000), internal: z.boolean().default(false) });

export async function updateTicketAdmin(auth: AuthContext, id: string, input: z.infer<typeof ticketUpdateSchema>) {
  const c = db();
  const { data: before } = await c.from('support_tickets').select('status, priority, assigned_to').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Ticket not found.');
  const patch: Database['public']['Tables']['support_tickets']['Update'] = {};
  if (input.status) patch.status = input.status;
  if (input.priority) patch.priority = input.priority;
  if (input.assignToMe) patch.assigned_to = auth.userId;
  if (input.unassign) patch.assigned_to = null;
  await c.from('support_tickets').update(patch).eq('id', id);
  await audit(auth, { action: 'admin.support.update', entityType: 'support_ticket', entityId: id, before, after: patch });
}

export async function staffReply(auth: AuthContext, id: string, input: z.infer<typeof staffReplySchema>) {
  const c = db();
  const { data: ticket } = await c.from('support_tickets').select('id, user_id, subject, status, assigned_to').eq('id', id).maybeSingle();
  if (!ticket) throw errors.notFound('Ticket not found.');
  const { data: msg, error } = await c.from('support_messages').insert({ ticket_id: id, author_user_id: auth.userId, is_staff: true, is_internal_note: input.internal, body: input.body }).select('id').single();
  if (error) throw error;
  if (!input.internal) {
    await c.from('support_tickets').update({ status: ticket.status === 'closed' ? 'closed' : 'pending_user', assigned_to: ticket.assigned_to ?? auth.userId }).eq('id', id);
    if (ticket.user_id) await notify({ userId: ticket.user_id, category: 'product_updates', templateKey: 'support_reply', vars: { subject: ticket.subject }, data: { href: `/app/support/${id}` } });
  }
  await audit(auth, { action: input.internal ? 'admin.support.note' : 'admin.support.reply', entityType: 'support_ticket', entityId: id, after: { messageId: msg.id } });
}
