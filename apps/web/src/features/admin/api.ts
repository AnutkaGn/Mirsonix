import {
  accessGrantListSchema,
  accessGrantSchema,
  adminProgramDetailSchema,
  adminProgramListSchema,
  adminTrackListSchema,
  adminTrackSchema,
  audioPreviewSchema,
  mediaAssetSchema,
  pricesSchema,
  revenueSeriesSchema,
  statsSummarySchema,
  topStatsSchema,
  uploadTicketSchema,
  type AccessGrantListQuery,
  type AdminProgramListQuery,
  type AdminTrackListQuery,
  type CreateAccessGrantInput,
  type CreateProgramInput,
  type CreateTrackInput,
  type SetPricesInput,
  type SetProgramTracksInput,
  type StatsQuery,
  type TopStatsQuery,
  type UpdateProgramInput,
  type UpdateTrackInput,
} from '@mirsonix/shared';
import { apiRequest } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';
import { postToStorage, readAudioDurationMs, uploadAsset, type UploadDeps } from './upload';

export const adminKeys = {
  all: ['admin'] as const,
  stats: (kind: 'summary' | 'revenue' | 'top', query: Partial<TopStatsQuery>) =>
    [...adminKeys.all, 'stats', kind, query] as const,
  tracks: (query: Partial<AdminTrackListQuery>) => [...adminKeys.all, 'tracks', query] as const,
  track: (id: string) => [...adminKeys.all, 'track', id] as const,
  programs: (query: Partial<AdminProgramListQuery>) =>
    [...adminKeys.all, 'programs', query] as const,
  program: (id: string) => [...adminKeys.all, 'program', id] as const,
  grants: (query: Partial<AccessGrantListQuery>) => [...adminKeys.all, 'grants', query] as const,
};

const json = (method: 'POST' | 'PUT' | 'PATCH', body: unknown = {}) => ({ method, body });

export const adminApi = {
  summary: (query: StatsQuery, signal?: AbortSignal) =>
    apiRequest(`/admin/stats/summary${toQueryString(query)}`, {
      schema: statsSummarySchema,
      signal,
    }),
  revenue: (query: StatsQuery, signal?: AbortSignal) =>
    apiRequest(`/admin/stats/revenue${toQueryString(query)}`, {
      schema: revenueSeriesSchema,
      signal,
    }),
  top: (query: TopStatsQuery, signal?: AbortSignal) =>
    apiRequest(`/admin/stats/top${toQueryString(query)}`, { schema: topStatsSchema, signal }),

  tracks: (query: Partial<AdminTrackListQuery>, signal?: AbortSignal) =>
    apiRequest(`/admin/tracks${toQueryString(query)}`, { schema: adminTrackListSchema, signal }),
  track: (id: string, signal?: AbortSignal) =>
    apiRequest(`/admin/tracks/${id}`, { schema: adminTrackSchema, signal }),
  createTrack: (input: CreateTrackInput) =>
    apiRequest('/admin/tracks', { ...json('POST', input), schema: adminTrackSchema }),
  updateTrack: (id: string, input: UpdateTrackInput) =>
    apiRequest(`/admin/tracks/${id}`, { ...json('PATCH', input), schema: adminTrackSchema }),
  publishTrack: (id: string) =>
    apiRequest(`/admin/tracks/${id}/publish`, { ...json('POST'), schema: adminTrackSchema }),
  archiveTrack: (id: string) =>
    apiRequest(`/admin/tracks/${id}/archive`, { ...json('POST'), schema: adminTrackSchema }),
  audioPreview: (id: string) =>
    apiRequest(`/admin/tracks/${id}/audio-preview`, { schema: audioPreviewSchema }),
  setTrackPrices: (id: string, input: SetPricesInput) =>
    apiRequest(`/admin/tracks/${id}/prices`, { ...json('PUT', input), schema: pricesSchema }),

  programs: (query: Partial<AdminProgramListQuery>, signal?: AbortSignal) =>
    apiRequest(`/admin/programs${toQueryString(query)}`, {
      schema: adminProgramListSchema,
      signal,
    }),
  program: (id: string, signal?: AbortSignal) =>
    apiRequest(`/admin/programs/${id}`, { schema: adminProgramDetailSchema, signal }),
  createProgram: (input: CreateProgramInput) =>
    apiRequest('/admin/programs', { ...json('POST', input), schema: adminProgramDetailSchema }),
  updateProgram: (id: string, input: UpdateProgramInput) =>
    apiRequest(`/admin/programs/${id}`, {
      ...json('PATCH', input),
      schema: adminProgramDetailSchema,
    }),
  setProgramTracks: (id: string, input: SetProgramTracksInput) =>
    apiRequest(`/admin/programs/${id}/tracks`, {
      ...json('PUT', input),
      schema: adminProgramDetailSchema,
    }),
  publishProgram: (id: string) =>
    apiRequest(`/admin/programs/${id}/publish`, {
      ...json('POST'),
      schema: adminProgramDetailSchema,
    }),
  archiveProgram: (id: string) =>
    apiRequest(`/admin/programs/${id}/archive`, {
      ...json('POST'),
      schema: adminProgramDetailSchema,
    }),
  setProgramPrices: (id: string, input: SetPricesInput) =>
    apiRequest(`/admin/programs/${id}/prices`, { ...json('PUT', input), schema: pricesSchema }),

  grants: (query: Partial<AccessGrantListQuery>, signal?: AbortSignal) =>
    apiRequest(`/admin/access-grants${toQueryString(query)}`, {
      schema: accessGrantListSchema,
      signal,
    }),
  createGrant: (input: CreateAccessGrantInput) =>
    apiRequest('/admin/access-grants', { ...json('POST', input), schema: accessGrantSchema }),
  revokeGrant: (id: string) =>
    apiRequest(`/admin/access-grants/${id}/revoke`, { ...json('POST'), schema: accessGrantSchema }),

  createUpload: (input: Parameters<UploadDeps['createTicket']>[0]) =>
    apiRequest('/admin/media/uploads', { ...json('POST', input), schema: uploadTicketSchema }),
  confirmUpload: (assetId: string, input: Parameters<UploadDeps['confirm']>[1]) =>
    apiRequest(`/admin/media/uploads/${assetId}/confirm`, {
      ...json('POST', input),
      schema: mediaAssetSchema,
    }),

  /** The whole browser → S3 upload with the real collaborators wired in. */
  uploadFile: (input: Parameters<typeof uploadAsset>[0]) =>
    uploadAsset(input, {
      createTicket: adminApi.createUpload,
      confirm: adminApi.confirmUpload,
      post: postToStorage,
      readDuration: readAudioDurationMs,
    }),
};
