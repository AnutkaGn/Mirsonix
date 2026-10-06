import { z } from 'zod';
import { AccessGrantSource, AccessSource } from '../enums';
import { hasExactlyOneTarget } from './billing';
import { programDetailSchema, programSummarySchema, trackSummarySchema } from './catalog';
import { paginated, paginationQuerySchema } from './common';

/** Why the listener can play something, and until when. */
export const accessInfoSchema = z.object({
  source: AccessSource.schema,
  /** End of the paid period or of the grant. Null when it does not end. */
  validUntil: z.string().nullable(),
  /** True when the subscription is set to stop at validUntil: access continues until then, and no longer. */
  cancelAtPeriodEnd: z.boolean(),
});
export type AccessInfo = z.infer<typeof accessInfoSchema>;

export const libraryTrackSchema = trackSummarySchema.extend({ access: accessInfoSchema });
export const libraryProgramSchema = programSummarySchema.extend({ access: accessInfoSchema });

/** Only what the listener has access to: directly bought tracks and programs. Tracks inside a program come with it. */
export const librarySchema = z.object({
  tracks: z.array(libraryTrackSchema),
  programs: z.array(libraryProgramSchema),
});
export type Library = z.infer<typeof librarySchema>;

export const libraryProgramDetailSchema = programDetailSchema.extend({ access: accessInfoSchema });
export type LibraryProgramDetail = z.infer<typeof libraryProgramDetailSchema>;

export const streamUrlSchema = z.object({ url: z.string(), expiresIn: z.number().int().positive() });
export type StreamUrl = z.infer<typeof streamUrlSchema>;

export const createAccessGrantSchema = z
  .object({
    userEmail: z.string().trim().toLowerCase().pipe(z.email()),
    trackId: z.uuid().optional(),
    programId: z.uuid().optional(),
    source: AccessGrantSource.schema.default('ADMIN'),
    /** Omit for access that does not expire. */
    expiresAt: z.iso.datetime().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine(hasExactlyOneTarget, { message: 'Provide exactly one of trackId or programId', path: ['trackId'] });
export type CreateAccessGrantInput = z.infer<typeof createAccessGrantSchema>;

export const accessGrantSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  userEmail: z.string(),
  trackId: z.uuid().nullable(),
  programId: z.uuid().nullable(),
  source: AccessGrantSource.schema,
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type AccessGrant = z.infer<typeof accessGrantSchema>;

export const accessGrantListQuerySchema = paginationQuerySchema.extend({ userId: z.uuid().optional() });
export type AccessGrantListQuery = z.infer<typeof accessGrantListQuerySchema>;
export const accessGrantListSchema = paginated(accessGrantSchema);
export type AccessGrantList = z.infer<typeof accessGrantListSchema>;
