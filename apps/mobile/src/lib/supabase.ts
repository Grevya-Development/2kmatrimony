import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { secureStorage } from './secure-store';

/**
 * Supabase client — used directly ONLY for auth and realtime. All data reads and
 * writes go through the /api/v1 REST API (see lib/api.ts).
 */
export const supabase = createClient(config.supabaseUrl || 'http://localhost', config.supabaseAnonKey || 'missing-anon-key', {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
