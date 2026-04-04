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

type AuthSessionResponse = {
  authenticated?: boolean;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | undefined>(undefined);

async function hasServerSideSessionCookie() {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
      },
    });

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as AuthSessionResponse;
    return Boolean(payload.authenticated);
  } catch {
    return false;
  }
}

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let isMounted = true;

    let syncSequence = 0;

    const syncAuthState = async (nextSession: Session | null) => {
      const currentSequence = ++syncSequence;

      if (nextSession) {
        if (!isMounted || currentSequence !== syncSequence) {
          return;
        }

        setSession(nextSession);
        setStatus('authenticated');
        return;
      }

      if (!isMounted || currentSequence !== syncSequence) {
        return;
      }

      setSession(null);

      const cookieAuthenticated = await hasServerSideSessionCookie();

      if (!isMounted || currentSequence !== syncSequence) {
        return;
      }

      setStatus(cookieAuthenticated ? 'authenticated' : 'unauthenticated');
    };

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;

        if (error) {
          void syncAuthState(null);
          return;
        }

        void syncAuthState(data.session ?? null);
      })
      .catch(() => {
        if (!isMounted) return;
        void syncAuthState(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession ?? null);
    });

    return () => {
      isMounted = false;
      syncSequence += 1;
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
