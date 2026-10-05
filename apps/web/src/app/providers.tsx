import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, type ReactNode } from 'react';
import { useBootstrapSession } from '@/features/auth/hooks';
import '@/i18n';
import { queryClient } from './query-client';

// `import.meta.env.DEV` is a build-time constant, so in production the bundler drops this import (and the
// devtools package with it) instead of shipping a lazy chunk nobody loads.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })))
  : null;

export function Providers({ children }: { children: ReactNode }) {
  useBootstrapSession();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {ReactQueryDevtools && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
