import { Injectable, NotFoundException } from '@nestjs/common';
import type { ContentStatus } from '@mirsonix/shared';
import type { ContentTarget } from '../../common/content-target';
import { ProgramsRepository } from './programs.repository';
import { TracksRepository } from './tracks.repository';

export interface ContentBasics {
  target: ContentTarget;
  title: string;
  description: string;
  status: ContentStatus;
  /** The Stripe product this item is sold as, once one exists. */
  stripeProductId: string | null;
}

/** The small slice of the catalog other modules (billing, streaming) need, so they never reach into repositories. */
@Injectable()
export class ContentLookupService {
  constructor(
    private readonly tracks: TracksRepository,
    private readonly programs: ProgramsRepository,
  ) {}

  async basics(target: ContentTarget): Promise<ContentBasics> {
    const item = target.kind === 'TRACK' ? await this.tracks.findById(target.id) : await this.programs.findById(target.id);
    if (!item) throw new NotFoundException(target.kind === 'TRACK' ? 'Track not found' : 'Program not found');
    return {
      target,
      title: item.title,
      description: item.description,
      status: item.status,
      stripeProductId: item.stripeProductId,
    };
  }

  async setStripeProductId(target: ContentTarget, stripeProductId: string): Promise<void> {
    if (target.kind === 'TRACK') await this.tracks.update(target.id, { stripeProductId });
    else await this.programs.update(target.id, { stripeProductId });
  }

  /** The audio object of a track, for issuing a stream URL. Callers must have checked access first. */
  async audioAssetIdOf(trackId: string): Promise<string> {
    const track = await this.tracks.findById(trackId);
    if (!track) throw new NotFoundException('Track not found');
    return track.audioAssetId;
  }
}
