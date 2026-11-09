/** Support API shapes (snake_case as returned by /api/v1/support — see docs/api/support.md). */
export const SUPPORT_CATEGORIES = ['account', 'billing', 'verification', 'safety', 'technical', 'feedback', 'other'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type TicketStatus = 'open' | 'pending_user' | 'resolved' | 'closed';

export interface Ticket {
  id: string;
  subject: string;
  category: SupportCategory;
  status: TicketStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}
export interface TicketMessage { id: string; body: string; is_staff: boolean; created_at: string }
export interface TicketThread { ticket: Ticket; messages: TicketMessage[] }

export const CATEGORY_LABELS: Record<SupportCategory, string> = {
  account: 'Account', billing: 'Billing & payments', verification: 'Verification', safety: 'Safety concern',
  technical: 'Something isn’t working', feedback: 'Feedback', other: 'Other',
};

export const STATUS_META: Record<TicketStatus, { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' }> = {
  open: { label: 'With our team', tone: 'info' },
  pending_user: { label: 'Awaiting your reply', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};

/** Closed tickets reject replies (409); resolved tickets reopen on reply. */
export const canReply = (s: TicketStatus) => s !== 'closed';
