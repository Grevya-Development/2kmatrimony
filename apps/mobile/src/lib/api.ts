import { Platform } from 'react-native';
import { createApiClient } from './api-core';
import { config } from './config';
import { setOnline } from './network';
import { supabase } from './supabase';

export { ApiClientError, errorMessage } from './api-core';

export const api = createApiClient({
  baseUrl: config.apiUrl,
  platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  refreshAccessToken: async () => {
    const { data, error } = await supabase.auth.refreshSession();
    return error ? null : data.session?.access_token ?? null;
  },
  onNetworkStatus: setOnline,
});

export const newClientId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
