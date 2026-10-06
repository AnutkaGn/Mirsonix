import { HEARTBEAT_INTERVAL_SEC } from '@mirsonix/shared';

export interface PlaybackApi {
  start: (input: { trackId: string; programId?: string }) => Promise<{ sessionId: string; resumeSec: number }>;
  heartbeat: (sessionId: string, body: { listenedSec: number; positionSec: number }, options?: { keepalive?: boolean }) => Promise<unknown>;
}

/**
 * Tells the server how long the listener really listened and where they stopped. Best effort: a failure must never
 * interrupt the music, so every network error is swallowed and the next heartbeat simply tries again.
 */
export class SessionReporter {
  private sessionId: string | null = null;
  private listenedSec = 0;
  private lastSentAt = 0;
  private lastSent = { listenedSec: -1, positionSec: -1 };
  /** Changes whenever a new session begins, so a slow reply for an earlier track cannot revive it. */
  private generation = 0;

  constructor(
    private readonly api: PlaybackApi,
    private readonly now: () => number = Date.now,
    private readonly intervalMs: number = HEARTBEAT_INTERVAL_SEC * 1000,
  ) {}

  /** Starts a session for a track and returns where to resume from (0 when unknown or on failure). */
  async begin(trackId: string, programId?: string): Promise<number> {
    const generation = ++this.generation;
    this.sessionId = null;
    this.listenedSec = 0;
    this.lastSentAt = this.now();
    this.lastSent = { listenedSec: -1, positionSec: -1 };
    try {
      const started = await this.api.start({ trackId, ...(programId && { programId }) });
      if (generation !== this.generation) return 0; // the listener has moved on to another track
      this.sessionId = started.sessionId;
      return started.resumeSec;
    } catch {
      return 0;
    }
  }

  /** Real time spent listening: at double speed a second of audio is half a second of listening. */
  addListening(realSeconds: number): void {
    if (this.sessionId && realSeconds > 0) this.listenedSec += realSeconds;
  }

  /** Called on every time update; sends a heartbeat only when one is due. */
  tick(positionSec: number): void {
    if (this.sessionId && this.now() - this.lastSentAt >= this.intervalMs) void this.send(positionSec);
  }

  /** Sends right away (pause, track end, page hidden), unless nothing changed since the last report. */
  flush(positionSec: number, options: { keepalive?: boolean } = {}): Promise<void> {
    return this.sessionId ? this.send(positionSec, options) : Promise.resolve();
  }

  end(): void {
    this.generation++;
    this.sessionId = null;
  }

  private async send(positionSec: number, options: { keepalive?: boolean } = {}): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId) return;
    const report = { listenedSec: Math.floor(this.listenedSec), positionSec: Math.floor(positionSec) };
    this.lastSentAt = this.now();
    if (report.listenedSec === this.lastSent.listenedSec && report.positionSec === this.lastSent.positionSec) return;
    this.lastSent = report;
    try {
      await this.api.heartbeat(sessionId, report, options);
    } catch {
      this.lastSent = { listenedSec: -1, positionSec: -1 }; // not delivered, so the next attempt must not be skipped as a repeat
    }
  }
}
