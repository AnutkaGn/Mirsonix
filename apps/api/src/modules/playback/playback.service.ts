import { Injectable, NotFoundException } from '@nestjs/common';
import {
  HEARTBEAT_SLACK_SEC,
  RESUME_END_MARGIN_SEC,
  listenThresholdSec,
  type HeartbeatInput,
  type HeartbeatResult,
  type SessionStarted,
  type StartSessionInput,
} from '@mirsonix/shared';
import { AccessService } from '../access/access.service';
import { ContentLookupService } from '../catalog/content-lookup.service';
import { PlaybackRepository } from './playback.repository';

/**
 * Records listening: where the user stopped (to resume) and how long they really listened (for the statistics).
 * The client reports its own numbers, so everything it says is bounded by what the server can check.
 */
@Injectable()
export class PlaybackService {
  constructor(
    private readonly repository: PlaybackRepository,
    private readonly access: AccessService,
    private readonly content: ContentLookupService,
  ) {}

  async startSession(userId: string, input: StartSessionInput, now: Date = new Date()): Promise<SessionStarted> {
    await this.access.assertTrackAccess(userId, input.trackId, now);
    // The program is only context for the statistics, but it must be one the listener actually holds.
    if (input.programId) await this.access.assertProgramAccess(userId, input.programId, now);

    const [durationSec, savedSec] = await Promise.all([
      this.content.durationSecOf(input.trackId),
      this.repository.findPositionSec(userId, input.trackId),
    ]);
    const session = await this.repository.createSession({ userId, trackId: input.trackId, programId: input.programId ?? null });
    // A track that was played to (nearly) its end starts over rather than resuming on its last second.
    const finished = savedSec >= durationSec - RESUME_END_MARGIN_SEC;
    return { sessionId: session.id, resumeSec: finished ? 0 : savedSec };
  }

  async heartbeat(userId: string, sessionId: string, input: HeartbeatInput, now: Date = new Date()): Promise<HeartbeatResult> {
    const session = await this.repository.findSession(sessionId, userId);
    if (!session) throw new NotFoundException('Playback session not found');
    const durationSec = await this.content.durationSecOf(session.trackId);

    // Nobody can have listened for longer than the session has existed, and listening time never goes backwards.
    const elapsedSec = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);
    const plausibleSec = Math.min(input.listenedSec, elapsedSec + HEARTBEAT_SLACK_SEC);
    const listenedSec = Math.max(session.listenedSec, plausibleSec);
    const countedAsListen = session.countedAsListen || listenedSec >= listenThresholdSec(durationSec);

    await this.repository.updateSession(session.id, { listenedSec, countedAsListen, lastHeartbeatAt: now });
    await this.repository.savePosition(userId, session.trackId, Math.min(input.positionSec, durationSec));
    return { counted: countedAsListen };
  }
}
