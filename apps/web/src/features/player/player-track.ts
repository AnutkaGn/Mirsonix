import type { TrackSummary } from '@mirsonix/shared';
import type { PlayerTrack } from './player.store';

/** The slice of a catalog or library track the player needs. */
export function toPlayerTrack(track: Pick<TrackSummary, 'id' | 'slug' | 'title' | 'durationSec' | 'coverUrl'>, programId?: string): PlayerTrack {
  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    durationSec: track.durationSec,
    coverUrl: track.coverUrl,
    ...(programId && { programId }),
  };
}
