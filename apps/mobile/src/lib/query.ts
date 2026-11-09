import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { QueryClient, dehydrate, hydrate, type Query } from '@tanstack/react-query';
import { ApiClientError } from './api-core';

const CACHE_KEY = '2k.query-cache.v1';
const MAX_AGE_MS = 24 * 3600_000;
/** Only list-like, non-sensitive screens are persisted for offline viewing. */
const PERSIST_ROOTS = new Set(['me', 'recommendations', 'interests', 'conversations', 'connections', 'notifications', 'plans', 'shortlist', 'profile']);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: MAX_AGE_MS,
      retry: (count, err) => !(err instanceof ApiClientError && err.status >= 400 && err.status < 500) && count < 2,
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'offlineFirst' },
  },
});

const shouldPersist = (q: Query) => q.state.status === 'success' && PERSIST_ROOTS.has(String(q.queryKey[0]));

export async function restoreQueryCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { at: number; state: unknown };
    if (Date.now() - parsed.at > MAX_AGE_MS) return void AsyncStorage.removeItem(CACHE_KEY);
    hydrate(queryClient, parsed.state as Parameters<typeof hydrate>[1]);
  } catch {
    await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
  }
}

export async function persistQueryCache(): Promise<void> {
  try {
    const state = dehydrate(queryClient, { shouldDehydrateQuery: shouldPersist });
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), state }));
  } catch {
    // best effort
  }
}

export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
}

AppState.addEventListener('change', (s) => {
  if (s === 'background' || s === 'inactive') void persistQueryCache();
});
