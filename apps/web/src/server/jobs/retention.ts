/** Retention policy (docs/DATABASE.md). Pure helpers so cut-offs are unit-testable. */
export const RETENTION = {
  dataExportDays: 7,
  verificationDocsDaysAfterDecision: 90,
  logsMonths: 13,
  rateLimitCounterDays: 2,
  usageCounterDays: 90,
} as const;

export const daysAgo = (days: number, now = new Date()) => new Date(now.getTime() - days * 86_400_000);

/** Same calendar day N months earlier (clamped to month end), in UTC. */
export function monthsAgo(months: number, now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(now.getUTCDate(), lastDay));
  return d;
}

export function retentionCutoffs(now = new Date()) {
  return {
    dataExports: daysAgo(RETENTION.dataExportDays, now),
    verificationDocs: daysAgo(RETENTION.verificationDocsDaysAfterDecision, now),
    logs: monthsAgo(RETENTION.logsMonths, now),
    rateLimitCounters: daysAgo(RETENTION.rateLimitCounterDays, now),
    usageCounters: daysAgo(RETENTION.usageCounterDays, now),
  };
}

/** Which reminder (if any) is due for a subscription ending at `end`. */
export function reminderDue(end: Date, sent7: boolean, sent1: boolean, now = new Date()): '7d' | '1d' | null {
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return null;
  if (ms <= 86_400_000 * 1.5 && !sent1) return '1d';
  if (ms <= 86_400_000 * 7 && !sent7 && ms > 86_400_000 * 1.5) return '7d';
  return null;
}
