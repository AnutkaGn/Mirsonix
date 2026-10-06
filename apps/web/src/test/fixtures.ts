import type { AccessInfo, Library, ProgramDetail, ProgramSummary, Taxonomy, TrackSummary } from '@mirsonix/shared';

export const PRICES = { month: { amountMinor: 999, currency: 'usd' }, year: { amountMinor: 9900, currency: 'usd' } };
export const NO_PRICES = { month: null, year: null };

export const makeTrack = (overrides: Partial<TrackSummary> = {}): TrackSummary => ({
  id: 't1',
  slug: 'lung-opening',
  title: 'Lung opening',
  description: 'Slow breathing for the Lung meridian.',
  durationSec: 600,
  frequencyHz: 432,
  waveType: 'SINE',
  coverUrl: null,
  prices: PRICES,
  meridians: [{ code: 'LU', name: 'Lung' }],
  issues: [{ slug: 'sleep', name: 'Sleep' }],
  ...overrides,
});

export const makeProgram = (overrides: Partial<ProgramSummary> = {}): ProgramSummary => ({
  id: 'p1',
  slug: 'back-recovery',
  title: 'Back recovery',
  description: 'Seven days to ease the spine.',
  posterUrl: null,
  prices: PRICES,
  trackCount: 3,
  totalDurationSec: 1800,
  ...overrides,
});

export const makeProgramDetail = (overrides: Partial<ProgramDetail> = {}): ProgramDetail => ({
  ...makeProgram(),
  tracks: [makeTrack({ id: 't1', title: 'Day one' }), makeTrack({ id: 't2', slug: 'day-two', title: 'Day two', durationSec: 1200 })],
  ...overrides,
});

export const page = <T>(items: T[], meta: Partial<{ page: number; limit: number; total: number; totalPages: number }> = {}) => ({
  items,
  meta: { page: 1, limit: 12, total: items.length, totalPages: 1, ...meta },
});

export const makeTaxonomy = (): Taxonomy => ({
  elements: [
    { code: 'WOOD', name: 'Wood', meridians: [{ id: 'm1', code: 'LR', name: 'Liver', polarity: 'YIN' }] },
    { code: 'METAL', name: 'Metal', meridians: [{ id: 'm2', code: 'LU', name: 'Lung', polarity: 'YIN' }] },
  ],
  vessels: [{ id: 'm3', code: 'GV', name: 'Governing Vessel', polarity: 'YANG' }],
  issues: [{ id: 'i1', slug: 'sleep', name: 'Sleep' }],
});

export const subscription = (overrides: Partial<AccessInfo> = {}): AccessInfo => ({
  source: 'TRACK_SUBSCRIPTION',
  validUntil: '2026-12-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  ...overrides,
});

export const makeLibrary = (overrides: Partial<Library> = {}): Library => ({ tracks: [], programs: [], ...overrides });
