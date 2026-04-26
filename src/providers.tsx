'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import StartupSplash from '@/components/ui/StartupSplash';
import { ReactNode, useEffect } from 'react';
import { store } from '@/store/store';
import { SupabaseAuthProvider } from '@/lib/supabase-auth';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Patch global fetch to add CSRF header for mutating same-origin requests.
    // Best-effort in browser only.
    void import('@/lib/fetch-csrf-client')
      .then((mod) => {
        mod.patchFetchWithCsrf?.();
      })
      .catch(() => {
        // ignore
      });
  }, []);
  return (
    <SupabaseAuthProvider>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <StartupSplash />
            <Toaster />
            <SonnerToaster />
            {children}
          </TooltipProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </SupabaseAuthProvider>
  );
}
