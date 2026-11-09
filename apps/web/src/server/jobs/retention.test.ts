import { describe, expect, it } from 'vitest';
import { monthsAgo, reminderDue, retentionCutoffs, daysAgo } from './retention';

describe('retention cut-offs', () => {
  const now = new Date('2026-11-09T21:00:00Z');
  it('computes day-based cut-offs', () => {
    const c = retentionCutoffs(now);
    expect(c.dataExports.toISOString()).toBe('2026-11-02T21:00:00.000Z');
    expect(c.verificationDocs.toISOString()).toBe('2026-08-11T21:00:00.000Z');
    expect(c.rateLimitCounters.toISOString()).toBe('2026-11-07T21:00:00.000Z');
    expect(daysAgo(0, now).getTime()).toBe(now.getTime());
  });
  it('computes 13 months back, clamping to month end', () => {
    expect(retentionCutoffs(now).logs.toISOString()).toBe('2025-10-09T21:00:00.000Z');
    expect(monthsAgo(1, new Date('2026-03-31T00:00:00Z')).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(monthsAgo(13, new Date('2026-01-15T10:00:00Z')).toISOString()).toBe('2024-12-15T10:00:00.000Z');
  });
});

describe('renewal reminders', () => {
  const now = new Date('2026-11-09T00:00:00Z');
  const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);
  it('sends the 7-day reminder once, then the 1-day reminder', () => {
    expect(reminderDue(inDays(10), false, false, now)).toBeNull();
    expect(reminderDue(inDays(6), false, false, now)).toBe('7d');
    expect(reminderDue(inDays(6), true, false, now)).toBeNull();
    expect(reminderDue(inDays(1), true, false, now)).toBe('1d');
    expect(reminderDue(inDays(1), true, true, now)).toBeNull();
    expect(reminderDue(inDays(-1), false, false, now)).toBeNull();
  });
});
