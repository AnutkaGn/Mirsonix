import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) =>
        !(error instanceof ApiRequestError && error.status < 500) && count < 2,
    },
  },
});
