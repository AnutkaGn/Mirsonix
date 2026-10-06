import type { Library } from '@mirsonix/shared';
import { describe, expect, it } from 'vitest';
import { toOwnership } from './api';

const access = (source: 'TRACK_SUBSCRIPTION' | 'PROGRAM_SUBSCRIPTION' | 'GRANT') => ({ source, validUntil: null, cancelAtPeriodEnd: false });
const base = { slug: 's', title: 't', description: 'd', prices: { month: null, year: null } };
const track = (id: string, source: Parameters<typeof access>[0]) =>
  ({ ...base, id, durationSec: 60, frequencyHz: null, waveType: null, coverUrl: null, meridians: [], issues: [], access: access(source) }) as Library['tracks'][number];
const program = (id: string, source: Parameters<typeof access>[0]) =>
  ({ ...base, id, posterUrl: null, trackCount: 1, totalDurationSec: 60, access: access(source) }) as Library['programs'][number];

describe('toOwnership', () => {
  it('lists the ids of what the listener holds, by kind', () => {
    const ownership = toOwnership({ tracks: [track('t1', 'TRACK_SUBSCRIPTION')], programs: [program('p1', 'PROGRAM_SUBSCRIPTION')] });

    expect([...ownership.trackIds]).toEqual(['t1']);
    expect([...ownership.programIds]).toEqual(['p1']);
  });

  it('knows a billing portal exists when anything is paid for', () => {
    expect(toOwnership({ tracks: [track('t1', 'TRACK_SUBSCRIPTION')], programs: [] }).hasSubscription).toBe(true);
    expect(toOwnership({ tracks: [], programs: [program('p1', 'PROGRAM_SUBSCRIPTION')] }).hasSubscription).toBe(true);
  });

  it('does not offer a billing portal to someone who only has gifts', () => {
    expect(toOwnership({ tracks: [track('t1', 'GRANT')], programs: [program('p1', 'GRANT')] }).hasSubscription).toBe(false);
  });

  it('is empty for an empty library', () => {
    expect(toOwnership({ tracks: [], programs: [] })).toEqual({ trackIds: new Set(), programIds: new Set(), hasSubscription: false });
  });
});
