import { z } from 'zod';
import { UPLOAD_LIMITS } from '../constants';
import { MediaKind, MediaStatus } from '../enums';

export const createUploadSchema = z
  .object({
    kind: MediaKind.schema,
    contentType: z.string().trim().toLowerCase().max(127),
    sizeBytes: z.number().int().positive(),
  })
  .superRefine((input, ctx) => {
    const limits = input.kind === 'AUDIO' ? UPLOAD_LIMITS.audio : UPLOAD_LIMITS.image;
    if (!(limits.mimeTypes as readonly string[]).includes(input.contentType)) {
      ctx.addIssue({ code: 'custom', path: ['contentType'], message: `Unsupported type. Allowed: ${limits.mimeTypes.join(', ')}` });
    }
    if (input.sizeBytes > limits.maxBytes) {
      ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: `File is too large (max ${limits.maxBytes} bytes)` });
    }
  });
export type CreateUploadInput = z.infer<typeof createUploadSchema>;

/** A presigned S3 POST form: the browser sends `fields` plus the file as a multipart form to `url`. */
export const uploadTicketSchema = z.object({
  assetId: z.uuid(),
  upload: z.object({ url: z.string(), fields: z.record(z.string(), z.string()) }),
  /** Seconds the form stays valid. */
  expiresIn: z.number().int().positive(),
  maxBytes: z.number().int().positive(),
});
export type UploadTicket = z.infer<typeof uploadTicketSchema>;

export const confirmUploadSchema = z.object({
  /** Measured in the browser from the audio metadata. Required for audio, ignored for images. */
  durationMs: z.number().int().positive().max(24 * 60 * 60 * 1000).optional(),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export const mediaAssetSchema = z.object({
  id: z.uuid(),
  kind: MediaKind.schema,
  status: MediaStatus.schema,
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  durationMs: z.number().int().nullable(),
});
export type MediaAsset = z.infer<typeof mediaAssetSchema>;
