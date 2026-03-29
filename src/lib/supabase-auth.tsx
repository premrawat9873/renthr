'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type SupabaseAuthContextValue = {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  signOut: () => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;

        if (error) {
          setSession(null);
          setStatus('unauthenticated');
          return;
        }

        const nextSession = data.session ?? null;
        setSession(nextSession);
        setStatus(nextSession ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
        setStatus('unauthenticated');
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<SupabaseAuthContextValue>(
    () => ({
      supabase,
      session,
      user: session?.user ?? null,
      status,
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
    }),
    [supabase, session, status]
  );

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);

  if (!context) {
    throw new Error('useSupabaseAuth must be used inside SupabaseAuthProvider.');
  }

  return context;
}
