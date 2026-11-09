'use client';
import * as React from 'react';
import type { MeResponse } from '@2k/shared';
import { api } from '@/lib/api';

const MeContext = React.createContext<{ me: MeResponse; refresh: () => Promise<void> } | null>(null);

export function MeProvider({ initial, children }: { initial: MeResponse; children: React.ReactNode }) {
  const [me, setMe] = React.useState(initial);
  const refresh = React.useCallback(async () => setMe(await api<MeResponse>('/me')), []);
  return <MeContext.Provider value={{ me, refresh }}>{children}</MeContext.Provider>;
}

export function useMe() {
  const ctx = React.useContext(MeContext);
  if (!ctx) throw new Error('useMe must be used within MeProvider');
  return ctx;
}
