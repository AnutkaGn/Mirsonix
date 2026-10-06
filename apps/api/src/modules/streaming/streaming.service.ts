import { Injectable } from '@nestjs/common';
import type { StreamUrl } from '@mirsonix/shared';
import { AccessService } from '../access/access.service';
import { ContentLookupService } from '../catalog/content-lookup.service';
import { MediaService } from '../media/media.service';

/** Turns "this user may play this track" into a short-lived link straight to the audio in storage. */
@Injectable()
export class StreamingService {
  constructor(
    private readonly access: AccessService,
    private readonly content: ContentLookupService,
    private readonly media: MediaService,
  ) {}

  async issueTrackUrl(userId: string, trackId: string, now: Date = new Date()): Promise<StreamUrl> {
    // First, before anything about the track is looked up: a listener without access learns nothing, not even whether it exists.
    await this.access.assertTrackAccess(userId, trackId, now);
    const audio = await this.media.requireReadyAsset(await this.content.audioAssetIdOf(trackId), 'AUDIO');
    return this.media.signedAudioUrl(audio);
  }
}
