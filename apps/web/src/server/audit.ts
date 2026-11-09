import 'server-only';
import type { Json } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from './auth';

export interface AuditEntry {
  action: string; // e.g. 'profile.update', 'admin.user.suspend', 'matching.config.update'
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Append an audit record. Never throws — auditing failures are logged, and the
 * caller's operation proceeds (the DB trigger keeps rows immutable).
 */
export async function audit(actor: AuthContext | null, entry: AuditEntry, actorType?: 'user' | 'admin' | 'system' | 'family'): Promise<void> {
  const { error } = await db().from('audit_logs').insert({
    actor_user_id: actor?.userId ?? null,
    actor_type: actorType ?? (actor?.admin ? 'admin' : actor ? 'user' : 'system'),
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    before_data: (entry.before ?? null) as Json,
    after_data: (entry.after ?? null) as Json,
    metadata: (entry.metadata ?? {}) as NonNullable<Json>,
    ip: actor?.ip ?? null,
    user_agent: actor?.userAgent ?? null,
  });
  if (error) console.error('[audit] failed to write', entry.action, error.message);
}
