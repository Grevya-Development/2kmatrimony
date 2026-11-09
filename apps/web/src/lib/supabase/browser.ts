'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@2k/shared';
import { publicEnv } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function supabaseBrowser() {
  if (!client) client = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return client;
}
