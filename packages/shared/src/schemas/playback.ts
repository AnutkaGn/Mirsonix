import { z } from 'zod';
import { LISTEN_MIN_RATIO, LISTEN_MIN_SECONDS } from '../constants';

const SECONDS_PER_DAY = 24 * 60 * 60;

export const startSessionSchema = z.object({
  trackId: z.uuid(),
  /** Set when the track is played from inside a program, so program statistics can be derived. */
  programId: z.uuid().optional(),
});
export type StartSessionInput = z.infer<typeof startSessionSchema>;

export const sessionStartedSchema = z.object({
  sessionId: z.uuid(),
  /** Where to continue from; 0 when the track was never started or was finished. */
  resumeSec: z.number().int().min(0),
});
export type SessionStarted = z.infer<typeof sessionStartedSchema>;

export const heartbeatSchema = z.object({
  /** Total seconds actually listened to in this session so far (not the position in the track). */
  listenedSec: z.number().int().min(0).max(SECONDS_PER_DAY),
  /** Current position in the track, saved for resume. */
  positionSec: z.number().int().min(0).max(SECONDS_PER_DAY),
});
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

export const heartbeatResultSchema = z.object({ counted: z.boolean() });
export type HeartbeatResult = z.infer<typeof heartbeatResultSchema>;

/**
 * Seconds of listening after which a session counts as one listen: 30 seconds or half the track, whichever comes
 * first, so a short track is not impossible to count.
 */
export const listenThresholdSec = (durationSec: number): number => Math.min(LISTEN_MIN_SECONDS, durationSec * LISTEN_MIN_RATIO);
