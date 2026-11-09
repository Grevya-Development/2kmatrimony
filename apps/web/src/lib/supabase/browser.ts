'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@2k/shared';
import { publicEnv } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function supabaseBrowser() {
  if (!client) client = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return client;
}

/**
 * Resolve once the realtime socket carries the signed-in user's JWT. Channels
 * joined before this run as `anon`, and RLS then (correctly) hides all rows —
 * so always await this before subscribing to postgres_changes or private channels.
 */
export async function realtimeReady(): Promise<ReturnType<typeof supabaseBrowser>> {
  const sb = supabaseBrowser();
  const { data } = await sb.auth.getSession();
  await sb.realtime.setAuth(data.session?.access_token ?? null);
  return sb;
}

type Channel = ReturnType<ReturnType<typeof supabaseBrowser>['channel']>;

/**
 * Build and subscribe channel(s) only after realtime auth is ready. Returns a
 * synchronous cleanup suitable for useEffect (safe if unmounted before ready).
 */
export function subscribeWhenReady(build: (sb: ReturnType<typeof supabaseBrowser>) => Channel | Channel[]): () => void {
  let cancelled = false;
  let channels: Channel[] = [];
  void realtimeReady().then((sb) => {
    if (cancelled) return;
    const built = build(sb);
    channels = Array.isArray(built) ? built : [built];
  });
  return () => {
    cancelled = true;
    const sb = supabaseBrowser();
    for (const ch of channels) void sb.removeChannel(ch);
  };
}
