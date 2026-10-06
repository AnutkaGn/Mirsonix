import { useCallback, useEffect, useRef, useState } from 'react';
import { playbackApi, streamApi } from './api';
import { selectCurrentTrack, usePlayerStore } from './player.store';
import { useProgressStore } from './progress.store';
import { SessionReporter } from './session-reporter';

/** Ask for a new link when the current one has less than this left, since resuming on an expired link fails. */
const URL_REFRESH_MARGIN_MS = 30_000;
/** Between two time updates, more than this is a seek, not listening. */
const MAX_LISTEN_STEP_SEC = 2;

const bufferedEnd = (audio: HTMLAudioElement): number => (audio.buffered.length > 0 ? audio.buffered.end(audio.buffered.length - 1) : 0);

/**
 * The one `<audio>` element of the app. It turns what the listener asks for (the player store) into actual audio, and
 * reports what really happened back: progress, track end, listening time. It renders nothing visible.
 */
export function PlayerEngine() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [reporter] = useState(() => new SessionReporter(playbackApi));
  const stream = useRef({ expiresAt: 0, resumeSec: 0, lastTime: 0, refreshing: false, errorRetried: false });

  const loadId = usePlayerStore((state) => state.loadId);
  const wantsPlay = usePlayerStore((state) => state.wantsPlay);
  const phase = usePlayerStore((state) => state.phase);
  const playbackRate = usePlayerStore((state) => state.playbackRate);
  const seekRequest = usePlayerStore((state) => state.seekRequest);
  const sleepTimer = usePlayerStore((state) => state.sleepTimer);

  const play = useCallback((audio: HTMLAudioElement) => {
    audio.play().catch((error: unknown) => {
      // The browser refuses to start sound that was not directly asked for. Show "paused" so the next tap, which
      // is a real gesture, starts it. An AbortError is just a pause that arrived while play() was starting.
      if ((error as { name?: string })?.name === 'NotAllowedError') usePlayerStore.getState().pause();
    });
  }, []);

  /** A new link for the same track, picking up exactly where playback was. Does not start a new listening session. */
  const refreshStream = useCallback(async () => {
    const audio = audioRef.current;
    const id = selectCurrentTrack(usePlayerStore.getState())?.id;
    if (!audio || !id || stream.current.refreshing) return;
    stream.current.refreshing = true;
    const position = audio.currentTime;
    usePlayerStore.getState().setPhase('loading');
    try {
      const { url, expiresIn } = await streamApi.getUrl(id);
      if (selectCurrentTrack(usePlayerStore.getState())?.id !== id) return; // the listener moved on meanwhile
      stream.current.expiresAt = Date.now() + expiresIn * 1000;
      stream.current.resumeSec = position;
      audio.src = url;
      audio.load();
    } catch {
      usePlayerStore.getState().setPhase('error');
    } finally {
      stream.current.refreshing = false;
    }
  }, []);

  /* A track was chosen (or retried): start its listening session and fetch its link together, then load it. */
  useEffect(() => {
    const audio = audioRef.current;
    const track = selectCurrentTrack(usePlayerStore.getState());
    if (!audio || !track) return;
    const controller = new AbortController();
    stream.current = { expiresAt: 0, resumeSec: 0, lastTime: 0, refreshing: false, errorRetried: false };
    useProgressStore.getState().reset(track.durationSec);
    usePlayerStore.getState().setPhase('loading');

    void (async () => {
      try {
        const [resumeSec, { url, expiresIn }] = await Promise.all([
          reporter.begin(track.id, track.programId),
          streamApi.getUrl(track.id, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        stream.current.expiresAt = Date.now() + expiresIn * 1000;
        stream.current.resumeSec = resumeSec;
        audio.src = url;
        audio.load();
      } catch {
        if (!controller.signal.aborted) usePlayerStore.getState().setPhase('error');
      }
    })();

    return () => {
      controller.abort();
      void reporter.flush(audio.currentTime || 0); // the last report for the track being left
    };
  }, [loadId, reporter]);

  /* What the listener asked for. Pausing always applies; starting waits until there is something to play. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!wantsPlay) {
      audio.pause();
      return;
    }
    if (phase !== 'ready') return; // `canplay` starts it once loaded
    if (stream.current.expiresAt && Date.now() > stream.current.expiresAt - URL_REFRESH_MARGIN_MS) void refreshStream();
    else play(audio);
  }, [wantsPlay, phase, play, refreshStream]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.defaultPlaybackRate = playbackRate; // survives loading the next track
    audio.playbackRate = playbackRate;
  }, [playbackRate, loadId]);

  /* The listener dragged the progress bar, pressed "previous", or a track is repeating. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !seekRequest) return;
    if (audio.readyState === 0) {
      stream.current.resumeSec = seekRequest.sec; // nothing loaded yet: apply it when it is
      return;
    }
    audio.currentTime = seekRequest.sec;
    stream.current.lastTime = seekRequest.sec;
    useProgressStore.getState().update({ positionSec: seekRequest.sec });
    if (usePlayerStore.getState().wantsPlay && audio.paused) play(audio);
  }, [seekRequest, play]);

  useEffect(() => {
    if (sleepTimer?.kind !== 'minutes') return; // "end of track" is decided when the track ends
    const timeout = setTimeout(() => {
      usePlayerStore.getState().pause();
      usePlayerStore.getState().setSleepTimer(null);
    }, Math.max(0, sleepTimer.endsAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [sleepTimer]);

  /* Leaving the page: send the last position before the tab goes. */
  useEffect(() => {
    const report = () => void reporter.flush(audioRef.current?.currentTime ?? 0, { keepalive: true });
    const onVisibility = () => document.visibilityState === 'hidden' && report();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', report);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', report);
    };
  }, [reporter]);

  /* Logging out (or any removal of the player) stops the sound. */
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      reporter.end();
      if (!audio) return;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, [reporter]);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      onLoadedMetadata={(event) => {
        const audio = event.currentTarget;
        const durationSec = Number.isFinite(audio.duration) ? audio.duration : (selectCurrentTrack(usePlayerStore.getState())?.durationSec ?? 0);
        useProgressStore.getState().update({ durationSec });
        const { resumeSec } = stream.current;
        if (resumeSec > 0 && resumeSec < durationSec) audio.currentTime = resumeSec;
        stream.current.resumeSec = 0;
        stream.current.lastTime = audio.currentTime;
      }}
      // Becoming ready is what starts playback: the effect on `wantsPlay` and `phase` does it, once.
      onCanPlay={() => usePlayerStore.getState().setPhase('ready')}
      onPlaying={() => {
        stream.current.errorRetried = false;
        usePlayerStore.getState().setPhase('ready');
      }}
      onWaiting={() => usePlayerStore.getState().setPhase('loading')}
      onTimeUpdate={(event) => {
        const audio = event.currentTarget;
        const step = audio.currentTime - stream.current.lastTime;
        stream.current.lastTime = audio.currentTime;
        if (!audio.paused && !audio.seeking && step > 0 && step <= MAX_LISTEN_STEP_SEC) reporter.addListening(step / (audio.playbackRate || 1));
        useProgressStore.getState().update({ positionSec: audio.currentTime, bufferedSec: bufferedEnd(audio) });
        reporter.tick(audio.currentTime);
      }}
      onSeeked={(event) => {
        stream.current.lastTime = event.currentTarget.currentTime;
      }}
      onPause={(event) => void reporter.flush(event.currentTarget.currentTime)}
      onEnded={(event) => {
        void reporter.flush(event.currentTarget.duration || event.currentTarget.currentTime);
        usePlayerStore.getState().finishTrack();
      }}
      onError={() => {
        // An expired or revoked link looks like a plain error. Try a fresh link once before giving up.
        if (!stream.current.errorRetried && stream.current.expiresAt) {
          stream.current.errorRetried = true;
          void refreshStream();
        } else {
          usePlayerStore.getState().setPhase('error');
        }
      }}
    />
  );
}
