import { heartbeatResultSchema, sessionStartedSchema, streamUrlSchema, type StreamUrl } from '@mirsonix/shared';
import { apiRequest } from '@/lib/api-client';
import type { PlaybackApi } from './session-reporter';

export const streamApi = {
  /** A fresh, short-lived link to the audio. The server checks access every time, so a lapsed subscription ends here. */
  getUrl: (trackId: string, signal?: AbortSignal): Promise<StreamUrl> =>
    apiRequest(`/stream/tracks/${trackId}/url`, { method: 'POST', body: {}, schema: streamUrlSchema, signal }),
};

export const playbackApi: PlaybackApi = {
  start: (input) => apiRequest('/playback/sessions', { method: 'POST', body: input, schema: sessionStartedSchema }),
  heartbeat: (sessionId, body, options) =>
    apiRequest(`/playback/sessions/${sessionId}/heartbeat`, { method: 'POST', body, schema: heartbeatResultSchema, keepalive: options?.keepalive }),
};
