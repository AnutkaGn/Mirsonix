import type {
  AdminProgram,
  AdminTrack,
  ProgramSummary,
  TrackSummary,
} from '@mirsonix/shared';
import type { Program } from './entities/program.entity';
import type { Track } from './entities/track.entity';
import type { ProgramAggregate } from './programs.repository';

const byCode = <T extends { code: string }>(a: T, b: T) => a.code.localeCompare(b.code);
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

/** Public shape of a track. It deliberately has no storage keys: audio is only reachable through signed URLs. */
export function toTrackSummary(track: Track, coverUrl: string | null): TrackSummary {
  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    description: track.description,
    durationSec: track.durationSec,
    frequencyHz: track.frequencyHz,
    waveType: track.waveType,
    coverUrl,
    meridians: track.trackMeridians.map(({ meridian }) => ({ code: meridian.code, name: meridian.name })).sort(byCode),
    issues: track.trackIssues.map(({ issue }) => ({ slug: issue.slug, name: issue.name })).sort(byName),
  };
}

export function toAdminTrack(track: Track, coverUrl: string | null): AdminTrack {
  return {
    ...toTrackSummary(track, coverUrl),
    status: track.status,
    audioAssetId: track.audioAssetId,
    coverAssetId: track.coverAssetId,
    publishedAt: track.publishedAt?.toISOString() ?? null,
    createdAt: track.createdAt.toISOString(),
    updatedAt: track.updatedAt.toISOString(),
  };
}

const EMPTY_AGGREGATE: ProgramAggregate = { trackCount: 0, totalDurationSec: 0 };

export function toProgramSummary(
  program: Program,
  posterUrl: string | null,
  aggregate: ProgramAggregate = EMPTY_AGGREGATE,
): ProgramSummary {
  return {
    id: program.id,
    slug: program.slug,
    title: program.title,
    description: program.description,
    posterUrl,
    trackCount: aggregate.trackCount,
    totalDurationSec: aggregate.totalDurationSec,
  };
}

export function toAdminProgram(program: Program, posterUrl: string | null, aggregate?: ProgramAggregate): AdminProgram {
  return {
    ...toProgramSummary(program, posterUrl, aggregate),
    status: program.status,
    posterAssetId: program.posterAssetId,
    publishedAt: program.publishedAt?.toISOString() ?? null,
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
  };
}
