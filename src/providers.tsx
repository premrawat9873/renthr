'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { ReactNode } from 'react';
import { store } from '@/store/store';
import { SupabaseAuthProvider } from '@/lib/supabase-auth';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SupabaseAuthProvider>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <SonnerToaster />
            {children}
          </TooltipProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </SupabaseAuthProvider>
  );
}
