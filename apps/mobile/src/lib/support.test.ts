import { describe, expect, it } from 'vitest';
import { canReply, CATEGORY_LABELS, STATUS_META, SUPPORT_CATEGORIES } from './support';
import { supportTicketSchema } from '@2k/shared';

describe('support helpers', () => {
  it('only closed tickets reject replies', () => {
    expect(canReply('open')).toBe(true);
    expect(canReply('pending_user')).toBe(true);
    expect(canReply('resolved')).toBe(true);
    expect(canReply('closed')).toBe(false);
  });
  it('covers every server category and status with labels', () => {
    for (const c of SUPPORT_CATEGORIES) expect(CATEGORY_LABELS[c]).toBeTruthy();
    expect(Object.keys(STATUS_META).sort()).toEqual(['closed', 'open', 'pending_user', 'resolved']);
  });
  it('mobile categories match the shared request schema', () => {
    for (const c of SUPPORT_CATEGORIES) expect(supportTicketSchema.safeParse({ category: c, subject: 'Help me', body: 'x' }).success).toBe(true);
  });
});
