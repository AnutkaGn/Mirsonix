import { describe, expect, it } from 'vitest';
import {
  createProgramSchema,
  createTrackSchema,
  setProgramTracksSchema,
  trackListQuerySchema,
  updateProgramSchema,
  updateTrackSchema,
} from './catalog';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const track = { title: 'Lung meridian', description: 'Slow breathing.', audioAssetId: id(1) };

describe('createTrackSchema', () => {
  it('defaults the taxonomy lists to empty and leaves the optional fields out', () => {
    expect(createTrackSchema.parse(track)).toEqual({ ...track, meridianIds: [], issueIds: [] });
  });

  it('requires a title, description and audio file', () => {
    expect(createTrackSchema.safeParse({ ...track, title: '   ' }).success).toBe(false);
    expect(createTrackSchema.safeParse({ title: 'x', description: 'y' }).success).toBe(false);
  });

  it('rejects a duplicate meridian id and a non-positive frequency', () => {
    expect(createTrackSchema.safeParse({ ...track, meridianIds: [id(2), id(2)] }).success).toBe(false);
    expect(createTrackSchema.safeParse({ ...track, frequencyHz: 0 }).success).toBe(false);
  });

  it('accepts null to mean "none" for the optional fields', () => {
    expect(createTrackSchema.safeParse({ ...track, coverAssetId: null, frequencyHz: null, waveType: null }).success).toBe(true);
  });
});

describe('updateTrackSchema', () => {
  it('does not invent values for fields the caller left out', () => {
    // A PATCH that omits the taxonomy lists must not wipe them, so no defaults may appear here.
    expect(updateTrackSchema.parse({ title: 'New title' })).toEqual({ title: 'New title' });
    expect(updateTrackSchema.parse({})).toEqual({});
  });

  it('still validates the fields that are present', () => {
    expect(updateTrackSchema.safeParse({ title: '' }).success).toBe(false);
  });
});

describe('program schemas', () => {
  it('lets a program be created with a title and description only', () => {
    expect(createProgramSchema.safeParse({ title: 'Back recovery', description: '7 days' }).success).toBe(true);
  });

  it('does not invent values on update', () => {
    expect(updateProgramSchema.parse({ posterAssetId: null })).toEqual({ posterAssetId: null });
  });

  it('rejects a track listed twice and more than 200 tracks', () => {
    expect(setProgramTracksSchema.safeParse({ trackIds: [id(1), id(1)] }).success).toBe(false);
    const many = Array.from({ length: 201 }, (_, i) => id(i + 1));
    expect(setProgramTracksSchema.safeParse({ trackIds: many }).success).toBe(false);
  });

  it('accepts an empty list (an empty program)', () => {
    expect(setProgramTracksSchema.safeParse({ trackIds: [] }).success).toBe(true);
  });
});

describe('trackListQuerySchema', () => {
  it('coerces query-string paging and applies the defaults', () => {
    expect(trackListQuerySchema.parse({ page: '2', limit: '5' })).toMatchObject({ page: 2, limit: 5 });
    expect(trackListQuerySchema.parse({})).toMatchObject({ page: 1, limit: 20 });
  });

  it('caps the page size', () => {
    expect(trackListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('rejects an unknown wave type or element', () => {
    expect(trackListQuerySchema.safeParse({ wave: 'SQUARE' }).success).toBe(false);
    expect(trackListQuerySchema.safeParse({ element: 'AIR' }).success).toBe(false);
  });
});
