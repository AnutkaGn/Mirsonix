import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlaybackProgress } from './entities/playback-progress.entity';
import { PlaybackSession } from './entities/playback-session.entity';

@Injectable()
export class PlaybackRepository {
  constructor(
    @InjectRepository(PlaybackSession) private readonly sessions: Repository<PlaybackSession>,
    @InjectRepository(PlaybackProgress) private readonly progress: Repository<PlaybackProgress>,
  ) {}

  async createSession(data: { userId: string; trackId: string; programId: string | null }): Promise<PlaybackSession> {
    return this.sessions.save(this.sessions.create(data));
  }

  /** Scoped to the owner, so one listener can never touch another's session by guessing its id. */
  findSession(id: string, userId: string): Promise<PlaybackSession | null> {
    return this.sessions.findOneBy({ id, userId });
  }

  async updateSession(id: string, patch: { listenedSec: number; countedAsListen: boolean; lastHeartbeatAt: Date }): Promise<void> {
    await this.sessions.update(id, patch);
  }

  async findPositionSec(userId: string, trackId: string): Promise<number> {
    return (await this.progress.findOneBy({ userId, trackId }))?.positionSec ?? 0;
  }

  async savePosition(userId: string, trackId: string, positionSec: number): Promise<void> {
    await this.progress.upsert({ userId, trackId, positionSec, updatedAt: new Date() }, ['userId', 'trackId']);
  }
}
