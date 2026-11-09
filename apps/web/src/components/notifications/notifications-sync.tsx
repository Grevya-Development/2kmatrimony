'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useMe } from '@/components/shell/me-context';

/** Keeps the unread badge live: listens for new notifications for the signed-in user. */
export function NotificationsSync() {
  const { me, refresh } = useMe();
  React.useEffect(() => {
    const sb = supabaseBrowser();
    const channel = sb
      .channel(`notifications:${me.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.user.id}` }, (payload) => {
        const row = payload.new as { title?: string; data?: { href?: string } };
        void refresh().catch(() => undefined);
        if (row.title && !window.location.pathname.startsWith('/app/notifications')) {
          toast(row.title, row.data?.href ? { action: { label: 'View', onClick: () => { window.location.href = row.data!.href!; } } } : undefined);
        }
      })
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, [me.user.id, refresh]);
  return null;
}
