import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ProgramListQuery, TrackListQuery } from '@mirsonix/shared';
import { catalogApi, catalogKeys } from './api';

const HOUR_MS = 60 * 60 * 1000;

/** The elements, meridians and issues change when an admin edits them, which is rare: cache for an hour. */
export const useTaxonomy = () =>
  useQuery({ queryKey: catalogKeys.taxonomy(), queryFn: ({ signal }) => catalogApi.taxonomy(signal), staleTime: HOUR_MS });

/** `keepPreviousData` keeps the old page on screen while the next loads, so filtering does not flash empty. */
export const useTracks = (query: Partial<TrackListQuery>) =>
  useQuery({ queryKey: catalogKeys.tracks(query), queryFn: ({ signal }) => catalogApi.tracks(query, signal), placeholderData: keepPreviousData });

export const useTrack = (slug: string) =>
  useQuery({ queryKey: catalogKeys.track(slug), queryFn: ({ signal }) => catalogApi.track(slug, signal) });

export const usePrograms = (query: Partial<ProgramListQuery>) =>
  useQuery({ queryKey: catalogKeys.programs(query), queryFn: ({ signal }) => catalogApi.programs(query, signal), placeholderData: keepPreviousData });

export const useProgram = (slug: string) =>
  useQuery({ queryKey: catalogKeys.program(slug), queryFn: ({ signal }) => catalogApi.program(slug, signal) });
