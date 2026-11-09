import Constants from 'expo-constants';

type Extra = { apiUrl?: string; supabaseUrl?: string; supabaseAnonKey?: string; eas?: { projectId?: string } };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Runtime configuration: EXPO_PUBLIC_* env (bundle time) overrides app.json `extra`. */
export const config = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || 'http://localhost:3000').replace(/\/$/, ''),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '',
  easProjectId: extra.eas?.projectId ?? (Constants.easConfig as { projectId?: string } | undefined)?.projectId ?? null,
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
};

export const isConfigured = () => !!(config.supabaseUrl && config.supabaseAnonKey);
