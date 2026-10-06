import { describe, expect, it } from 'vitest';
import { NO_PRICES } from '../pricing/price-book';
import { toAdminProgram, toAdminTrack, toProgramSummary, toTrackSummary } from './catalog.mapper';
import type { Program } from './entities/program.entity';
import type { Track } from './entities/track.entity';

const track = {
  id: 't1',
  slug: 'lung-opening',
  title: 'Lung opening',
  description: 'desc',
  durationSec: 600,
  frequencyHz: 432,
  waveType: 'SINE',
  status: 'PUBLISHED',
  audioAssetId: 'audio-asset',
  coverAssetId: 'cover-asset',
  publishedAt: new Date('2026-01-02T03:04:05Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-03T00:00:00Z'),
  trackMeridians: [
    { meridian: { code: 'LU', name: 'Lung' } },
    { meridian: { code: 'GB', name: 'Gallbladder' } },
  ],
  trackIssues: [{ issue: { slug: 'sleep', name: 'Sleep' } }, { issue: { slug: 'back-pain', name: 'Back pain' } }],
} as unknown as Track;

describe('toTrackSummary', () => {
  it('sorts meridians by code and issues by name so the output is stable', () => {
    const summary = toTrackSummary(track, 'https://cdn/c.png', NO_PRICES);

    expect(summary.meridians.map((m) => m.code)).toEqual(['GB', 'LU']);
    expect(summary.issues.map((i) => i.name)).toEqual(['Back pain', 'Sleep']);
    expect(summary.coverUrl).toBe('https://cdn/c.png');
  });

  it('carries no storage keys or asset ids, so a listener cannot find the audio from the catalog', () => {
    const json = JSON.stringify(toTrackSummary(track, null, NO_PRICES));

    expect(json).not.toContain('audio-asset');
    expect(json).not.toContain('cover-asset');
    expect(Object.keys(toTrackSummary(track, null, NO_PRICES))).not.toContain('audioAssetId');
  });
});

describe('toAdminTrack', () => {
  it('adds editing fields and ISO dates', () => {
    expect(toAdminTrack(track, null, NO_PRICES)).toMatchObject({
      status: 'PUBLISHED',
      audioAssetId: 'audio-asset',
      coverAssetId: 'cover-asset',
      publishedAt: '2026-01-02T03:04:05.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('reports a track that was never published as null, not as an invalid date', () => {
    expect(toAdminTrack({ ...track, publishedAt: null } as Track, null, NO_PRICES).publishedAt).toBeNull();
  });
});

const program = {
  id: 'p1',
  slug: 'back-recovery',
  title: 'Back recovery',
  description: 'seven days',
  status: 'DRAFT',
  posterAssetId: null,
  publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
} as unknown as Program;

describe('prices in the summaries', () => {
  const prices = { month: { amountMinor: 999, currency: 'usd' }, year: { amountMinor: 9900, currency: 'usd' } };

  it('puts the prices on a track and on a program', () => {
    expect(toTrackSummary(track, null, prices).prices).toEqual(prices);
    expect(toProgramSummary(program, null, prices).prices).toEqual(prices);
  });

  it('shows an item with nothing on sale as having no prices', () => {
    expect(toTrackSummary(track, null, NO_PRICES).prices).toEqual({ month: null, year: null });
  });
});

describe('program mappers', () => {
  it('defaults the totals to zero for a program with no tracks', () => {
    expect(toProgramSummary(program, null, NO_PRICES)).toMatchObject({ trackCount: 0, totalDurationSec: 0 });
  });

  it('uses the supplied aggregate', () => {
    expect(toProgramSummary(program, 'https://cdn/p.png', NO_PRICES, { trackCount: 3, totalDurationSec: 1800 })).toMatchObject({
      posterUrl: 'https://cdn/p.png',
      trackCount: 3,
      totalDurationSec: 1800,
    });
  });

  it('adds the admin fields', () => {
    expect(toAdminProgram(program, null, NO_PRICES)).toMatchObject({ status: 'DRAFT', posterAssetId: null, publishedAt: null });
  });
});
