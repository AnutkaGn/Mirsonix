import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccessGrantListQuery,
  AdminProgramListQuery,
  AdminTrackListQuery,
  SetPricesInput,
  StatsQuery,
  TopStatsQuery,
  UpdateProgramInput,
  UpdateTrackInput,
} from '@mirsonix/shared';
import { catalogKeys } from '@/features/catalog/api';
import { adminApi, adminKeys } from './api';

const MINUTE_MS = 60 * 1000;

/** Numbers move when people buy and listen, but a dashboard that is a minute old is fine. */
export const useStatsSummary = (query: StatsQuery) =>
  useQuery({
    queryKey: adminKeys.stats('summary', query),
    queryFn: ({ signal }) => adminApi.summary(query, signal),
    staleTime: MINUTE_MS,
  });

export const useRevenueSeries = (query: StatsQuery) =>
  useQuery({
    queryKey: adminKeys.stats('revenue', query),
    queryFn: ({ signal }) => adminApi.revenue(query, signal),
    staleTime: MINUTE_MS,
  });

export const useTopStats = (query: TopStatsQuery) =>
  useQuery({
    queryKey: adminKeys.stats('top', query),
    queryFn: ({ signal }) => adminApi.top(query, signal),
    staleTime: MINUTE_MS,
  });

export const useAdminTracks = (query: Partial<AdminTrackListQuery>) =>
  useQuery({
    queryKey: adminKeys.tracks(query),
    queryFn: ({ signal }) => adminApi.tracks(query, signal),
    placeholderData: keepPreviousData,
  });

export const useAdminTrack = (id: string | undefined) =>
  useQuery({
    queryKey: adminKeys.track(id ?? ''),
    queryFn: ({ signal }) => adminApi.track(id as string, signal),
    enabled: Boolean(id),
    retry: false,
  });

export const useAdminPrograms = (query: Partial<AdminProgramListQuery>) =>
  useQuery({
    queryKey: adminKeys.programs(query),
    queryFn: ({ signal }) => adminApi.programs(query, signal),
    placeholderData: keepPreviousData,
  });

export const useAdminProgram = (id: string | undefined) =>
  useQuery({
    queryKey: adminKeys.program(id ?? ''),
    queryFn: ({ signal }) => adminApi.program(id as string, signal),
    enabled: Boolean(id),
    retry: false,
  });

export const useAccessGrants = (query: Partial<AccessGrantListQuery>) =>
  useQuery({
    queryKey: adminKeys.grants(query),
    queryFn: ({ signal }) => adminApi.grants(query, signal),
    placeholderData: keepPreviousData,
  });

/**
 * Anything an admin changes may change what listeners see, so both the admin lists and the public catalog refetch.
 * Invalidating by prefix is cheap: only queries currently on screen are refetched.
 */
function useContentMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.all }),
        queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
      ]),
  });
}

export const useCreateTrack = () => useContentMutation(adminApi.createTrack);
export const useUpdateTrack = (id: string) =>
  useContentMutation((input: UpdateTrackInput) => adminApi.updateTrack(id, input));
export const usePublishTrack = () => useContentMutation(adminApi.publishTrack);
export const useArchiveTrack = () => useContentMutation(adminApi.archiveTrack);
export const useSetTrackPrices = (id: string) =>
  useContentMutation((input: SetPricesInput) => adminApi.setTrackPrices(id, input));

export const useCreateProgram = () => useContentMutation(adminApi.createProgram);
export const useUpdateProgram = (id: string) =>
  useContentMutation((input: UpdateProgramInput) => adminApi.updateProgram(id, input));
export const useSetProgramTracks = (id: string) =>
  useContentMutation((trackIds: string[]) => adminApi.setProgramTracks(id, { trackIds }));
export const usePublishProgram = () => useContentMutation(adminApi.publishProgram);
export const useArchiveProgram = () => useContentMutation(adminApi.archiveProgram);
export const useSetProgramPrices = (id: string) =>
  useContentMutation((input: SetPricesInput) => adminApi.setProgramPrices(id, input));

export const useCreateGrant = () => useContentMutation(adminApi.createGrant);
export const useRevokeGrant = () => useContentMutation(adminApi.revokeGrant);

/** A signed link to the stored audio, fetched on demand: it expires, so it is never cached. */
export const useAudioPreview = () => useMutation({ mutationFn: adminApi.audioPreview });
