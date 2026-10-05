import { z } from 'zod';
import { ContentStatus, WaveType, WuXingElement } from '../enums';
import { paginated, paginationQuerySchema } from './common';

/* ---------- taxonomy ---------- */

export const meridianRefSchema = z.object({ code: z.string(), name: z.string() });
export const issueRefSchema = z.object({ slug: z.string(), name: z.string() });

export const taxonomySchema = z.object({
  elements: z.array(
    z.object({
      code: WuXingElement.schema,
      name: z.string(),
      meridians: z.array(z.object({ id: z.uuid(), code: z.string(), name: z.string(), polarity: z.enum(['YIN', 'YANG']) })),
    }),
  ),
  /** Governing and Conception vessels belong to no element. */
  vessels: z.array(z.object({ id: z.uuid(), code: z.string(), name: z.string(), polarity: z.enum(['YIN', 'YANG']) })),
  issues: z.array(z.object({ id: z.uuid(), slug: z.string(), name: z.string() })),
});
export type Taxonomy = z.infer<typeof taxonomySchema>;

/* ---------- reading (any signed-in user; published content only) ---------- */

export const trackSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  durationSec: z.number().int(),
  frequencyHz: z.number().nullable(),
  waveType: WaveType.schema.nullable(),
  coverUrl: z.string().nullable(),
  meridians: z.array(meridianRefSchema),
  issues: z.array(issueRefSchema),
});
export type TrackSummary = z.infer<typeof trackSummarySchema>;

export const trackListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
  wave: WaveType.schema.optional(),
  issue: z.string().max(80).optional(),
  meridian: z.string().max(4).optional(),
  element: WuXingElement.schema.optional(),
});
export type TrackListQuery = z.infer<typeof trackListQuerySchema>;
export const trackListSchema = paginated(trackSummarySchema);
export type TrackList = z.infer<typeof trackListSchema>;

export const programSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  posterUrl: z.string().nullable(),
  trackCount: z.number().int(),
  totalDurationSec: z.number().int(),
});
export type ProgramSummary = z.infer<typeof programSummarySchema>;

export const programDetailSchema = programSummarySchema.extend({ tracks: z.array(trackSummarySchema) });
export type ProgramDetail = z.infer<typeof programDetailSchema>;

export const programListQuerySchema = paginationQuerySchema.extend({ q: z.string().trim().min(1).max(100).optional() });
export type ProgramListQuery = z.infer<typeof programListQuerySchema>;
export const programListSchema = paginated(programSummarySchema);
export type ProgramList = z.infer<typeof programListSchema>;

/* ---------- admin ---------- */

const uniqueIds = z
  .array(z.uuid())
  .max(30)
  .refine((ids) => new Set(ids).size === ids.length, 'Duplicate ids');

const trackFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  audioAssetId: z.uuid(),
  coverAssetId: z.uuid().nullable(),
  frequencyHz: z.number().positive().max(100_000).nullable(),
  waveType: WaveType.schema.nullable(),
  meridianIds: uniqueIds,
  issueIds: uniqueIds,
};

/** Optional fields stay optional on create; the id lists default to empty. PATCH never applies defaults. */
export const createTrackSchema = z
  .object(trackFields)
  .partial({ coverAssetId: true, frequencyHz: true, waveType: true })
  .extend({ meridianIds: uniqueIds.default([]), issueIds: uniqueIds.default([]) });
export type CreateTrackInput = z.infer<typeof createTrackSchema>;

export const updateTrackSchema = z.object(trackFields).partial();
export type UpdateTrackInput = z.infer<typeof updateTrackSchema>;

export const adminTrackSchema = trackSummarySchema.extend({
  status: ContentStatus.schema,
  audioAssetId: z.uuid(),
  coverAssetId: z.uuid().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminTrack = z.infer<typeof adminTrackSchema>;

export const adminTrackListQuerySchema = trackListQuerySchema.extend({ status: ContentStatus.schema.optional() });
export type AdminTrackListQuery = z.infer<typeof adminTrackListQuerySchema>;
export const adminTrackListSchema = paginated(adminTrackSchema);
export type AdminTrackList = z.infer<typeof adminTrackListSchema>;

export const audioPreviewSchema = z.object({ url: z.string(), expiresIn: z.number().int().positive() });
export type AudioPreview = z.infer<typeof audioPreviewSchema>;

const programFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  posterAssetId: z.uuid().nullable(),
};
export const createProgramSchema = z.object(programFields).partial({ posterAssetId: true });
export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export const updateProgramSchema = z.object(programFields).partial();
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

/** The full ordered track list of a program; the array index becomes the order. */
export const setProgramTracksSchema = z.object({
  trackIds: z
    .array(z.uuid())
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, 'A track can appear in a program only once'),
});
export type SetProgramTracksInput = z.infer<typeof setProgramTracksSchema>;

export const adminProgramSchema = programSummarySchema.extend({
  status: ContentStatus.schema,
  posterAssetId: z.uuid().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminProgram = z.infer<typeof adminProgramSchema>;

export const adminProgramDetailSchema = adminProgramSchema.extend({
  tracks: z.array(adminTrackSchema),
});
export type AdminProgramDetail = z.infer<typeof adminProgramDetailSchema>;

export const adminProgramListQuerySchema = programListQuerySchema.extend({ status: ContentStatus.schema.optional() });
export type AdminProgramListQuery = z.infer<typeof adminProgramListQuerySchema>;
export const adminProgramListSchema = paginated(adminProgramSchema);
export type AdminProgramList = z.infer<typeof adminProgramListSchema>;
