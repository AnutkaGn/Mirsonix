import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playbackApi, streamApi } from './api';
import { PlayerEngine } from './PlayerEngine';
import { usePlayerStore, type PlayerTrack } from './player.store';
import { useProgressStore } from './progress.store';

vi.mock('./api', () => ({
  streamApi: { getUrl: vi.fn() },
  playbackApi: { start: vi.fn(), heartbeat: vi.fn() },
}));

const getUrl = vi.mocked(streamApi.getUrl);
const start = vi.mocked(playbackApi.start);
const heartbeat = vi.mocked(playbackApi.heartbeat);

const track = (n: number, programId?: string): PlayerTrack => ({
  id: `t${n}`,
  slug: `track-${n}`,
  title: `Track ${n}`,
  durationSec: 600,
  coverUrl: null,
  ...(programId && { programId }),
});
const store = () => usePlayerStore.getState();
const progress = () => useProgressStore.getState();

let playSpy: ReturnType<typeof vi.spyOn>;
let pauseSpy: ReturnType<typeof vi.spyOn>;

/** Everything a browser does between "src was set" and "music is playing", in the order it does it. */
function mount() {
  const { container, unmount } = render(<PlayerEngine />);
  const audio = container.querySelector('audio') as HTMLAudioElement;
  let time = 0;
  Object.defineProperty(audio, 'currentTime', { get: () => time, set: (value: number) => (time = value), configurable: true });
  Object.defineProperty(audio, 'duration', { value: 600, configurable: true });
  Object.defineProperty(audio, 'readyState', { value: 4, configurable: true, writable: true });
  return {
    audio,
    unmount,
    setTime: (value: number) => (time = value),
    loadMetadata: () => fireEvent.loadedMetadata(audio),
    canPlay: () => fireEvent.canPlay(audio),
    tick: (value: number) => {
      time = value;
      fireEvent.timeUpdate(audio);
    },
  };
}

/** What a browser does when playback reaches the end: the element pauses itself, then `ended` fires. */
function endTrack(audio: HTMLAudioElement) {
  Object.defineProperty(audio, 'paused', { value: true, configurable: true });
  fireEvent.pause(audio);
  fireEvent.ended(audio);
}

/** Lets the engine's async work (session + stream link) finish. */
const settle = () => act(async () => void (await Promise.resolve()));

async function startPlaying(tracks: PlayerTrack[], index = 0) {
  const engine = mount();
  act(() => store().playQueue(tracks, index));
  await settle();
  engine.loadMetadata();
  engine.canPlay();
  return engine;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  store().clear();
  usePlayerStore.setState({ playbackRate: 1, loop: 'off' });
  progress().reset();
  getUrl.mockReset().mockResolvedValue({ url: 'https://audio.test/a.mp3', expiresIn: 600 });
  start.mockReset().mockResolvedValue({ sessionId: 's-1', resumeSec: 0 });
  heartbeat.mockReset().mockResolvedValue({ counted: false });
  playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { value: false, configurable: true });
    return Promise.resolve();
  });
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { value: true, configurable: true });
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('loading a track', () => {
  it('starts a listening session and fetches the stream link together, then loads the audio', async () => {
    const { audio } = mount();

    act(() => store().playQueue([track(1, 'p-1')]));
    await settle();

    expect(getUrl).toHaveBeenCalledWith('t1', expect.any(AbortSignal));
    expect(start).toHaveBeenCalledWith({ trackId: 't1', programId: 'p-1' });
    expect(audio.getAttribute('src')).toBe('https://audio.test/a.mp3');
    expect(store().phase).toBe('loading');
  });

  it('plays as soon as the audio can, when the listener asked for it', async () => {
    await startPlaying([track(1)]);

    expect(store().phase).toBe('ready');
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('does not start sound the listener has already cancelled while it loaded', async () => {
    const engine = mount();
    act(() => store().playQueue([track(1)]));
    await settle();

    act(() => store().pause());
    engine.canPlay();

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('shows an error, and does not crash, when the stream link cannot be had', async () => {
    getUrl.mockRejectedValue(new Error('403'));
    mount();

    act(() => store().playQueue([track(1)]));
    await settle();

    expect(store().phase).toBe('error');
  });

  it('shows the track\'s length from the playlist data until the audio reports its own', async () => {
    mount();
    act(() => store().playQueue([track(1)]));

    expect(progress()).toMatchObject({ positionSec: 0, durationSec: 600 });
  });
});

describe('resuming', () => {
  it('continues from where the listener stopped', async () => {
    start.mockResolvedValue({ sessionId: 's-1', resumeSec: 42 });
    const engine = mount();
    act(() => store().playQueue([track(1)]));
    await settle();

    engine.loadMetadata();

    expect(engine.audio.currentTime).toBe(42);
  });

  it('ignores a saved position that lies beyond the audio', async () => {
    start.mockResolvedValue({ sessionId: 's-1', resumeSec: 9999 });
    const engine = mount();
    act(() => store().playQueue([track(1)]));
    await settle();

    engine.loadMetadata();

    expect(engine.audio.currentTime).toBe(0);
  });
});

describe('what the listener asks for', () => {
  it('pauses and plays again on request', async () => {
    const engine = await startPlaying([track(1)]);

    act(() => store().togglePlay());
    expect(pauseSpy).toHaveBeenCalled();

    playSpy.mockClear();
    act(() => store().togglePlay());
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(engine.audio.paused).toBe(false);
  });

  it('really pauses while the connection is stalled, instead of resuming on its own when data arrives', async () => {
    const engine = await startPlaying([track(1)]);
    fireEvent.waiting(engine.audio);
    expect(store().phase).toBe('loading');

    act(() => store().pause());

    expect(pauseSpy).toHaveBeenCalled();
  });

  it('shows "paused" when the browser refuses to start sound, so the next tap can', async () => {
    playSpy.mockRejectedValue(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    await startPlaying([track(1)]);
    await settle();

    expect(store().wantsPlay).toBe(false);
  });

  it('applies the playback speed, and keeps it for the next track', async () => {
    const engine = await startPlaying([track(1), track(2)]);

    act(() => store().setPlaybackRate(1.5));
    expect(engine.audio.playbackRate).toBe(1.5);

    act(() => store().next());
    await settle();
    expect(engine.audio.defaultPlaybackRate).toBe(1.5);
  });

  it('jumps when asked, updating the progress bar at once', async () => {
    const engine = await startPlaying([track(1)]);

    act(() => store().seekTo(300));

    expect(engine.audio.currentTime).toBe(300);
    expect(progress().positionSec).toBe(300);
  });

  it('holds a jump requested before anything is loaded, and applies it on load', async () => {
    const engine = mount();
    Object.defineProperty(engine.audio, 'readyState', { value: 0, configurable: true });
    act(() => store().playQueue([track(1)]));
    await settle();

    act(() => store().seekTo(120));
    expect(engine.audio.currentTime).toBe(0);

    engine.loadMetadata();
    expect(engine.audio.currentTime).toBe(120);
  });
});

describe('progress', () => {
  it('follows the audio', async () => {
    const engine = await startPlaying([track(1)]);

    engine.tick(37);

    expect(progress().positionSec).toBe(37);
  });
});

describe('when a track ends', () => {
  it('moves on to the next track and loads it', async () => {
    const engine = await startPlaying([track(1), track(2)]);

    endTrack(engine.audio);
    await settle();

    expect(store().index).toBe(1);
    expect(getUrl).toHaveBeenLastCalledWith('t2', expect.any(AbortSignal));
    expect(start).toHaveBeenLastCalledWith({ trackId: 't2' });
  });

  it('stops after the last track', async () => {
    const engine = await startPlaying([track(1)]);
    getUrl.mockClear();

    endTrack(engine.audio);
    await settle();

    expect(store().wantsPlay).toBe(false);
    expect(getUrl).not.toHaveBeenCalled();
  });

  it('plays the same track again in repeat-one mode, without fetching it again', async () => {
    usePlayerStore.setState({ loop: 'one' });
    const engine = await startPlaying([track(1), track(2)]);
    getUrl.mockClear();
    playSpy.mockClear();
    engine.setTime(599);

    endTrack(engine.audio);
    await settle();

    expect(engine.audio.currentTime).toBe(0);
    expect(playSpy).toHaveBeenCalled();
    expect(getUrl).not.toHaveBeenCalled();
    expect(store().index).toBe(0);
  });

  it('falls asleep at the end of the track when the timer says so', async () => {
    const engine = await startPlaying([track(1), track(2)]);
    act(() => store().setSleepTimer('end-of-track'));

    endTrack(engine.audio);
    await settle();

    expect(store()).toMatchObject({ index: 0, wantsPlay: false, sleepTimer: null });
  });
});

describe('sleep timer', () => {
  it('pauses when the minutes are up, and is spent', async () => {
    await startPlaying([track(1), track(2)]);
    act(() => store().setSleepTimer({ minutes: 30 }));

    act(() => void vi.advanceTimersByTime(29 * 60_000));
    expect(store().wantsPlay).toBe(true);

    act(() => void vi.advanceTimersByTime(60_000));
    expect(store()).toMatchObject({ wantsPlay: false, sleepTimer: null });
  });

  it('does not fire after it was cancelled', async () => {
    await startPlaying([track(1)]);
    act(() => store().setSleepTimer({ minutes: 15 }));
    act(() => store().setSleepTimer(null));

    act(() => void vi.advanceTimersByTime(60 * 60_000));

    expect(store().wantsPlay).toBe(true);
  });
});

describe('listening reports', () => {
  /** One second of playback per step, as a browser fires time updates. */
  const listenFor = (engine: ReturnType<typeof mount>, seconds: number, mediaPerSecond = 1) => {
    for (let second = 1; second <= seconds; second++) {
      vi.setSystemTime(Date.now() + 1000);
      engine.tick(engine.audio.currentTime + mediaPerSecond);
    }
  };

  it('reports progress once the interval has passed', async () => {
    const engine = await startPlaying([track(1)]);

    listenFor(engine, 16);

    expect(heartbeat).toHaveBeenCalledWith('s-1', { listenedSec: 15, positionSec: 15 }, {});
  });

  it('counts real listening time, so double speed is not double counted', async () => {
    usePlayerStore.setState({ playbackRate: 2 });
    const engine = await startPlaying([track(1)]);
    engine.audio.playbackRate = 2;

    listenFor(engine, 16, 2); // 16 real seconds covering 32 seconds of audio

    expect(heartbeat).toHaveBeenCalledWith('s-1', { listenedSec: 15, positionSec: 30 }, {});
  });

  it('does not count a jump through the track as listening', async () => {
    const engine = await startPlaying([track(1)]);

    vi.setSystemTime(Date.now() + 20_000);
    engine.tick(500); // 500 seconds ahead in one step: the listener scrubbed, they did not listen

    expect(heartbeat).toHaveBeenCalledWith('s-1', { listenedSec: 0, positionSec: 500 }, {});
  });

  it('reports at once when the listener pauses', async () => {
    const engine = await startPlaying([track(1)]);
    engine.tick(5);
    heartbeat.mockClear();

    fireEvent.pause(engine.audio);

    expect(heartbeat).toHaveBeenCalledTimes(1);
  });

  it('sends a last report for the old track when the listener moves to another', async () => {
    const engine = await startPlaying([track(1), track(2)]);
    engine.tick(20);

    act(() => store().next());
    await settle();

    expect(heartbeat).toHaveBeenCalledWith('s-1', expect.objectContaining({ positionSec: 20 }), expect.anything());
  });
});

describe('links that expire', () => {
  it('asks for a fresh link after a long pause, and carries on from the same second without a new session', async () => {
    const engine = await startPlaying([track(1)]);
    engine.tick(88);
    act(() => store().pause());

    vi.setSystemTime(Date.now() + 11 * 60_000); // the link lasted ten minutes
    getUrl.mockResolvedValue({ url: 'https://audio.test/fresh.mp3', expiresIn: 600 });
    act(() => store().togglePlay());
    await settle();

    expect(getUrl).toHaveBeenCalledTimes(2);
    expect(engine.audio.getAttribute('src')).toBe('https://audio.test/fresh.mp3');
    expect(start).toHaveBeenCalledTimes(1);
    engine.setTime(0); // a fresh element position after reload
    engine.loadMetadata();
    expect(engine.audio.currentTime).toBe(88);
  });

  it('does not ask again while the link is still good', async () => {
    await startPlaying([track(1)]);
    act(() => store().pause());
    vi.setSystemTime(Date.now() + 2 * 60_000);

    act(() => store().togglePlay());
    await settle();

    expect(getUrl).toHaveBeenCalledTimes(1);
  });

  it('retries once with a fresh link when the audio fails, and then reports the error', async () => {
    const engine = await startPlaying([track(1)]);

    fireEvent.error(engine.audio);
    await settle();
    expect(getUrl).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(1);

    fireEvent.error(engine.audio);
    await settle();
    expect(getUrl).toHaveBeenCalledTimes(2);
    expect(store().phase).toBe('error');
  });
});

describe('leaving', () => {
  it('stops the sound when the player is removed, as on logging out', async () => {
    const engine = await startPlaying([track(1)]);

    engine.unmount();

    expect(pauseSpy).toHaveBeenCalled();
    expect(engine.audio.hasAttribute('src')).toBe(false);
  });
});
