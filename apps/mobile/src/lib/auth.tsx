import * as React from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { clearQueryCache } from './query';
import { securePrefs } from './secure-store';

interface AuthState {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState>({ session: null, loading: true, signOut: async () => undefined });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut().catch(() => undefined);
    await clearQueryCache();
    await securePrefs.remove('biometric_enabled').catch(() => undefined);
    setSession(null);
  }, []);

  return <AuthContext.Provider value={{ session, loading, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => React.useContext(AuthContext);
