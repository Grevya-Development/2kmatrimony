import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@2k/shared';
import { publicEnv, serverEnv } from '@/lib/env';

let client: SupabaseClient<Database> | null = null;

/** Service-role client. Bypasses RLS — only use inside the API/server layer. */
export function db(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
export type Db = SupabaseClient<Database>;
