import { beforeEach, describe, expect, it } from 'vitest';
import { selectCurrentTrack, usePlayerStore, type PlayerTrack } from './player.store';

const track = (n: number, programId?: string): PlayerTrack => ({
  id: `t${n}`,
  slug: `track-${n}`,
  title: `Track ${n}`,
  durationSec: 600,
  coverUrl: null,
  ...(programId && { programId }),
});
const three = [track(1), track(2), track(3)];
const state = () => usePlayerStore.getState();

beforeEach(() => {
  state().clear();
  usePlayerStore.setState({ playbackRate: 1, loop: 'off' });
});

describe('playQueue', () => {
  it('loads the queue, starts at the chosen track and asks to play', () => {
    state().playQueue(three, 1);

    expect(selectCurrentTrack(state())?.id).toBe('t2');
    expect(state()).toMatchObject({ wantsPlay: true, phase: 'loading', index: 1 });
  });

  it('starts at the first track by default, and keeps the start inside the queue', () => {
    state().playQueue(three);
    expect(state().index).toBe(0);

    state().playQueue(three, 99);
    expect(state().index).toBe(2);

    state().playQueue(three, -4);
    expect(state().index).toBe(0);
  });

  it('ignores an empty queue instead of leaving the player in a broken state', () => {
    state().playQueue([]);

    expect(state()).toMatchObject({ queue: [], index: -1, wantsPlay: false });
    expect(selectCurrentTrack(state())).toBeNull();
  });

  it('drops a pending seek from the previous queue', () => {
    state().playQueue(three);
    state().seekTo(120);
    state().playQueue(three, 2);

    expect(state().seekRequest).toBeNull();
  });
});

describe('togglePlay and pause', () => {
  it('does nothing when there is no track', () => {
    state().togglePlay();

    expect(state().wantsPlay).toBe(false);
  });

  it('flips between playing and paused', () => {
    state().playQueue(three);
    state().togglePlay();
    expect(state().wantsPlay).toBe(false);
    state().togglePlay();
    expect(state().wantsPlay).toBe(true);
  });

  it('pauses', () => {
    state().playQueue(three);
    state().pause();

    expect(state().wantsPlay).toBe(false);
  });
});

describe('next', () => {
  it('moves to the next track and plays it', () => {
    state().playQueue(three);
    state().pause();
    state().next();

    expect(state()).toMatchObject({ index: 1, wantsPlay: true, phase: 'loading' });
  });

  it('stays on the last track when the queue does not repeat', () => {
    state().playQueue(three, 2);
    state().next();

    expect(state().index).toBe(2);
  });

  it('wraps to the first track when the queue repeats', () => {
    usePlayerStore.setState({ loop: 'all' });
    state().playQueue(three, 2);
    state().next();

    expect(state().index).toBe(0);
  });
});

describe('previous', () => {
  it('restarts the track when it has been playing for a while', () => {
    state().playQueue(three, 1);
    state().previous(30);

    expect(state().index).toBe(1);
    expect(state().seekRequest).toMatchObject({ sec: 0 });
  });

  it('goes back a track when it has only just started', () => {
    state().playQueue(three, 1);
    state().previous(2);

    expect(state()).toMatchObject({ index: 0, wantsPlay: true });
  });

  it('restarts the first track instead of going nowhere', () => {
    state().playQueue(three, 0);
    state().previous(1);

    expect(state().index).toBe(0);
    expect(state().seekRequest).toMatchObject({ sec: 0 });
  });

  it('does nothing without a track', () => {
    state().previous(0);

    expect(state().seekRequest).toBeNull();
  });
});

describe('jumpTo', () => {
  it('plays the chosen queue entry', () => {
    state().playQueue(three);
    state().jumpTo(2);

    expect(state().index).toBe(2);
  });

  it.each([-1, 3, 99])('ignores the out-of-range index %i', (index) => {
    state().playQueue(three, 1);
    state().jumpTo(index);

    expect(state().index).toBe(1);
  });
});

describe('seekTo', () => {
  it('asks the engine to jump, never to a negative time', () => {
    state().seekTo(-10);

    expect(state().seekRequest).toMatchObject({ sec: 0 });
  });

  it('makes two requests for the same second distinct, so the engine acts on both', () => {
    state().seekTo(5);
    const first = state().seekRequest;
    state().seekTo(5);

    expect(state().seekRequest?.id).not.toBe(first?.id);
  });
});

describe('preferences', () => {
  it('cycles the repeat mode', () => {
    state().cycleLoop();
    expect(state().loop).toBe('all');
    state().cycleLoop();
    expect(state().loop).toBe('one');
    state().cycleLoop();
    expect(state().loop).toBe('off');
  });

  it('sets the playback speed', () => {
    state().setPlaybackRate(1.5);

    expect(state().playbackRate).toBe(1.5);
  });

  it('remembers only speed and repeat across a reload, never the queue', () => {
    state().playQueue(three);
    state().setPlaybackRate(1.25);
    const saved = usePlayerStore.persist.getOptions().partialize?.(state());

    expect(saved).toEqual({ playbackRate: 1.25, loop: 'off' });
  });
});

describe('finishTrack (a track ended by itself)', () => {
  it('plays on to the next track', () => {
    state().playQueue(three);
    state().finishTrack();

    expect(state()).toMatchObject({ index: 1, wantsPlay: true, phase: 'loading' });
  });

  it('stops after the last track', () => {
    state().playQueue(three, 2);
    state().finishTrack();

    expect(state()).toMatchObject({ index: 2, wantsPlay: false });
  });

  it('wraps to the start when the queue repeats', () => {
    usePlayerStore.setState({ loop: 'all' });
    state().playQueue(three, 2);
    state().finishTrack();

    expect(state()).toMatchObject({ index: 0, wantsPlay: true });
  });

  it('replays the same track in repeat-one mode, by seeking to the start', () => {
    usePlayerStore.setState({ loop: 'one' });
    state().playQueue(three, 1);
    state().finishTrack();

    expect(state()).toMatchObject({ index: 1, wantsPlay: true });
    expect(state().seekRequest).toMatchObject({ sec: 0 });
  });

  it('falls asleep after this track when the timer is "end of track", and the timer is spent', () => {
    state().playQueue(three);
    state().setSleepTimer('end-of-track');
    state().finishTrack();

    expect(state()).toMatchObject({ index: 0, wantsPlay: false, sleepTimer: null });
  });

  it('stops for the end-of-track timer even in repeat-one mode', () => {
    usePlayerStore.setState({ loop: 'one' });
    state().playQueue(three);
    state().setSleepTimer('end-of-track');
    state().finishTrack();

    expect(state().wantsPlay).toBe(false);
  });

  it('goes on playing for a timer that counts minutes, since that one is handled by the clock', () => {
    state().playQueue(three);
    state().setSleepTimer({ minutes: 30 });
    state().finishTrack();

    expect(state()).toMatchObject({ index: 1, wantsPlay: true });
  });
});

describe('sleep timer', () => {
  it('ends the given number of minutes from now', () => {
    state().setSleepTimer({ minutes: 30 }, 1_000_000);

    expect(state().sleepTimer).toEqual({ kind: 'minutes', endsAt: 1_000_000 + 30 * 60_000, minutes: 30 });
  });

  it('can be replaced and cancelled', () => {
    state().setSleepTimer({ minutes: 15 }, 0);
    state().setSleepTimer('end-of-track');
    expect(state().sleepTimer).toEqual({ kind: 'end-of-track' });

    state().setSleepTimer(null);
    expect(state().sleepTimer).toBeNull();
  });
});

describe('clear', () => {
  it('empties the player, but keeps the listener\'s speed and repeat choices', () => {
    usePlayerStore.setState({ playbackRate: 1.5, loop: 'all' });
    state().playQueue(three, 1);
    state().setSleepTimer({ minutes: 15 });
    state().setExpanded(true);

    state().clear();

    expect(state()).toMatchObject({ queue: [], index: -1, wantsPlay: false, phase: 'idle', sleepTimer: null, expanded: false, playbackRate: 1.5, loop: 'all' });
  });
});

describe('loadId (when the engine must load a track)', () => {
  const load = () => state().loadId;

  it('changes whenever a different track is chosen', () => {
    const start = load();
    state().playQueue(three);
    const afterPlay = load();
    state().next();
    const afterNext = load();
    state().previous(1);
    const afterPrevious = load();
    state().jumpTo(2);
    const afterJump = load();

    expect(new Set([start, afterPlay, afterNext, afterPrevious, afterJump]).size).toBe(5);
  });

  it('changes when a track ends and the next one starts', () => {
    state().playQueue(three);
    const before = load();
    state().finishTrack();

    expect(load()).not.toBe(before);
  });

  it('does not change when the same track just repeats, pauses, or is sought', () => {
    usePlayerStore.setState({ loop: 'one' });
    state().playQueue(three);
    const before = load();

    state().finishTrack();
    state().pause();
    state().togglePlay();
    state().seekTo(30);
    state().previous(30); // restarts rather than leaving the track

    expect(load()).toBe(before);
  });

  it('reload loads the current track again and asks to play', () => {
    state().playQueue(three, 1);
    usePlayerStore.setState({ phase: 'error', wantsPlay: false });
    const before = load();

    state().reload();

    expect(load()).not.toBe(before);
    expect(state()).toMatchObject({ index: 1, phase: 'loading', wantsPlay: true });
  });

  it('reload with nothing queued does nothing', () => {
    state().reload();

    expect(state()).toMatchObject({ index: -1, wantsPlay: false });
  });
});
