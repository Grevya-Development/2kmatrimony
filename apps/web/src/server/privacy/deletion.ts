import 'server-only';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { getSetting } from '@/server/config';
import { errors } from '@/server/http';
import { removeObjects } from '@/server/media';
import { notify } from '@/server/notify';
import { refreshProfileDerived } from '@/server/profiles/completion';

/** Schedule account deletion after the configured grace period. */
export async function scheduleDeletion(auth: AuthContext, reason: string | null) {
  const c = db();
  const { data: open } = await c.from('data_requests').select('id, scheduled_for').eq('user_id', auth.userId).eq('kind', 'deletion').eq('status', 'pending').maybeSingle();
  if (open) return { requestId: open.id, scheduledFor: open.scheduled_for };
  const privacy = await getSetting('privacy', { deletion_grace_days: 14, export_link_hours: 24 });
  const scheduledFor = new Date(Date.now() + privacy.deletion_grace_days * 86_400_000).toISOString();
  const { data, error } = await c.from('data_requests').insert({ user_id: auth.userId, kind: 'deletion', status: 'pending', scheduled_for: scheduledFor, notes: reason }).select('id').single();
  if (error) throw error;
  await c.from('app_users').update({ status: 'pending_deletion', deletion_requested_at: new Date().toISOString() }).eq('id', auth.userId);
  if (auth.profile) await c.from('profiles').update({ status: 'hidden' }).eq('id', auth.profile.id);
  await audit(auth, { action: 'privacy.deletion.schedule', entityType: 'app_user', entityId: auth.userId, after: { scheduledFor } });
  await notify({ userId: auth.userId, category: 'security', templateKey: 'account_deletion_scheduled', vars: { date: new Date(scheduledFor).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) }, forceChannels: ['email'] });
  return { requestId: data.id, scheduledFor };
}

export async function cancelDeletion(auth: AuthContext) {
  const c = db();
  const { data: open } = await c.from('data_requests').select('id').eq('user_id', auth.userId).eq('kind', 'deletion').eq('status', 'pending').maybeSingle();
  if (!open) throw errors.notFound('No deletion is scheduled.');
  await c.from('data_requests').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', open.id);
  await c.from('app_users').update({ status: 'active', deletion_requested_at: null }).eq('id', auth.userId);
  if (auth.profile) {
    const { data: prof } = await c.from('profiles').select('activated_at').eq('id', auth.profile.id).single();
    if (prof?.activated_at) {
      // Already approved by our team before: restore the live profile without re-screening.
      await c.from('profiles').update({ status: 'active' }).eq('id', auth.profile.id).eq('status', 'hidden');
    } else {
      // Never went live: back to draft, which resubmits it for screening if complete.
      await c.from('profiles').update({ status: 'draft' }).eq('id', auth.profile.id);
      await refreshProfileDerived(auth.profile.id);
    }
  }
  await audit(auth, { action: 'privacy.deletion.cancel', entityType: 'app_user', entityId: auth.userId });
  return { ok: true };
}

async function storagePathsFor(userId: string, profileId: string | null) {
  const c = db();
  const paths = { photos: [] as string[], videos: [] as string[], docs: [] as string[], chat: [] as string[], exports: [] as string[] };
  if (profileId) {
    const [ph, vi, ve] = await Promise.all([
      c.from('profile_photos').select('storage_path').eq('profile_id', profileId),
      c.from('profile_videos').select('storage_path').eq('profile_id', profileId),
      c.from('verifications').select('document_paths').eq('profile_id', profileId),
    ]);
    paths.photos = (ph.data ?? []).map((r) => r.storage_path);
    paths.videos = (vi.data ?? []).map((r) => r.storage_path);
    paths.docs = (ve.data ?? []).flatMap((r) => r.document_paths);
  }
  const { data: msgs } = await c.from('messages').select('media_path').eq('sender_user_id', userId).not('media_path', 'is', null);
  paths.chat = (msgs ?? []).map((m) => m.media_path!).filter(Boolean);
  const { data: ex } = await c.storage.from('data-exports').list(userId, { limit: 100 });
  paths.exports = (ex ?? []).map((o) => `${userId}/${o.name}`);
  return paths;
}

/**
 * Permanently delete accounts whose grace period has ended. Accounts with
 * payment records are anonymised instead (GST law requires retaining invoices),
 * which is why payments/invoices reference app_users with ON DELETE RESTRICT.
 */
export async function executeDueDeletions(now = new Date()): Promise<{ deleted: number }> {
  const c = db();
  const { data: due } = await c.from('data_requests').select('id, user_id').eq('kind', 'deletion').eq('status', 'pending').lte('scheduled_for', now.toISOString()).limit(100);
  let deleted = 0;
  for (const req of due ?? []) {
    try {
      const { data: profile } = await c.from('profiles').select('id').eq('owner_user_id', req.user_id).maybeSingle();
      const paths = await storagePathsFor(req.user_id, profile?.id ?? null);
      // Mark messages sent by the member as removed before identities disappear.
      await c.from('messages').update({ body: null, media_path: null, deleted_at: now.toISOString(), kind: 'system' }).eq('sender_user_id', req.user_id).neq('kind', 'system');
      await Promise.all([
        removeObjects('profile-photos', paths.photos),
        removeObjects('profile-videos', paths.videos),
        removeObjects('verification-docs', paths.docs),
        removeObjects('chat-media', paths.chat),
        removeObjects('data-exports', paths.exports),
      ]);
      await audit(null, { action: 'privacy.deletion.execute', entityType: 'app_user', entityId: req.user_id, metadata: { requestId: req.id } }, 'system');

      const [{ count: payments }, { count: invoices }] = await Promise.all([
        c.from('payments').select('id', { count: 'exact', head: true }).eq('user_id', req.user_id),
        c.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', req.user_id),
      ]);
      if ((payments ?? 0) + (invoices ?? 0) === 0) {
        // Full erasure: cascades through app_users to every user-owned row.
        const { error } = await c.auth.admin.deleteUser(req.user_id);
        if (error) throw error;
      } else {
        // Anonymise: remove the profile (cascades its data), scrub identity, disable sign-in.
        if (profile) await c.from('profiles').delete().eq('id', profile.id);
        await Promise.all([
          c.from('user_devices').delete().eq('user_id', req.user_id),
          c.from('notifications').delete().eq('user_id', req.user_id),
          c.from('notification_preferences').delete().eq('user_id', req.user_id),
          c.from('ai_threads').delete().eq('user_id', req.user_id),
          c.from('family_members').delete().eq('member_user_id', req.user_id),
        ]);
        await c.auth.admin.updateUserById(req.user_id, {
          email: `deleted-${req.user_id}@deleted.invalid`,
          phone: '',
          user_metadata: {},
          ban_duration: '876000h',
        });
        await c.from('app_users').update({ phone: null, email: null, full_name: null, status: 'deleted', deleted_at: now.toISOString(), signup_ip: null, signup_user_agent: null }).eq('id', req.user_id);
        await c.from('data_requests').update({ status: 'completed', completed_at: now.toISOString() }).eq('id', req.id);
      }
      deleted++;
    } catch (err) {
      console.error('[privacy] deletion failed', req.user_id, err);
      await c.from('data_requests').update({ notes: `Deletion attempt failed: ${err instanceof Error ? err.message.slice(0, 150) : 'error'}` }).eq('id', req.id);
    }
  }
  return { deleted };
}
