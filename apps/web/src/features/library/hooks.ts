import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { libraryApi, libraryKeys, toOwnership } from './api';

/** `pollMs` keeps refreshing, as after returning from checkout while Stripe's webhook has not arrived yet. */
export const useLibrary = (options: { pollMs?: number | false } = {}) =>
  useQuery({
    queryKey: libraryKeys.list(),
    queryFn: ({ signal }) => libraryApi.get(signal),
    refetchInterval: options.pollMs || false,
  });

/** Shares the library's cache entry: asking for ownership on twenty cards costs one request, not twenty. */
export const useOwnership = () => {
  const signedIn = useAuthStore((state) => state.status === 'authenticated');
  return useQuery({ queryKey: libraryKeys.list(), queryFn: ({ signal }) => libraryApi.get(signal), select: toOwnership, enabled: signedIn });
};

export const useLibraryProgram = (id: string) =>
  useQuery({ queryKey: libraryKeys.program(id), queryFn: ({ signal }) => libraryApi.program(id, signal), retry: false });
