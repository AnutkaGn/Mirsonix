import { describe, expect, it } from 'vitest';
import { UPLOAD_LIMITS } from '../constants';
import { confirmUploadSchema, createUploadSchema } from './media';

describe('createUploadSchema', () => {
  const audio = { kind: 'AUDIO', contentType: 'audio/mpeg', sizeBytes: 1_000_000 };

  it('accepts a supported audio file', () => {
    expect(createUploadSchema.safeParse(audio).success).toBe(true);
  });

  it('normalises the content type', () => {
    expect(createUploadSchema.parse({ ...audio, contentType: ' Audio/MPEG ' }).contentType).toBe('audio/mpeg');
  });

  it('rejects a content type that does not belong to the kind', () => {
    expect(createUploadSchema.safeParse({ ...audio, contentType: 'image/png' }).success).toBe(false);
    expect(createUploadSchema.safeParse({ kind: 'IMAGE', contentType: 'audio/mpeg', sizeBytes: 10 }).success).toBe(false);
  });

  it('enforces the size limit of each kind at the boundary', () => {
    expect(createUploadSchema.safeParse({ ...audio, sizeBytes: UPLOAD_LIMITS.audio.maxBytes }).success).toBe(true);
    expect(createUploadSchema.safeParse({ ...audio, sizeBytes: UPLOAD_LIMITS.audio.maxBytes + 1 }).success).toBe(false);
    const image = { kind: 'IMAGE', contentType: 'image/webp' };
    expect(createUploadSchema.safeParse({ ...image, sizeBytes: UPLOAD_LIMITS.image.maxBytes }).success).toBe(true);
    expect(createUploadSchema.safeParse({ ...image, sizeBytes: UPLOAD_LIMITS.image.maxBytes + 1 }).success).toBe(false);
  });

  it('rejects an empty or fractional size', () => {
    expect(createUploadSchema.safeParse({ ...audio, sizeBytes: 0 }).success).toBe(false);
    expect(createUploadSchema.safeParse({ ...audio, sizeBytes: 1.5 }).success).toBe(false);
  });
});

describe('confirmUploadSchema', () => {
  it('allows no duration (images) and rejects a non-positive one', () => {
    expect(confirmUploadSchema.safeParse({}).success).toBe(true);
    expect(confirmUploadSchema.safeParse({ durationMs: 0 }).success).toBe(false);
  });
});
