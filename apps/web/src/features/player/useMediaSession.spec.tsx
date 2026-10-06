import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerStore, type PlayerTrack } from './player.store';
import { useProgressStore } from './progress.store';
import { useMediaSession } from './useMediaSession';

const track = (n: number, coverUrl: string | null = null): PlayerTrack => ({ id: `t${n}`, slug: `track-${n}`, title: `Track ${n}`, durationSec: 600, coverUrl });
const store = () => usePlayerStore.getState();

type Handler = ((details: { seekTime?: number }) => void) | null;
let handlers: Record<string, Handler>;
let session: { metadata: unknown; playbackState: string; setActionHandler: ReturnType<typeof vi.fn> };

beforeEach(() => {
  store().clear();
  handlers = {};
  session = {
    metadata: null,
    playbackState: 'none',
    setActionHandler: vi.fn((action: string, handler: Handler) => {
      handlers[action] = handler;
    }),
  };
  Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
  vi.stubGlobal('MediaMetadata', class { constructor(public init: object) {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaSession');
});

describe('useMediaSession', () => {
  it('tells the operating system what is playing, with its artwork', () => {
    renderHook(() => useMediaSession());

    act(() => store().playQueue([track(1, 'https://cdn/c.png')]));

    expect(session.metadata).toMatchObject({ init: { title: 'Track 1', artist: 'Mirsonix', artwork: [{ src: 'https://cdn/c.png' }] } });
    expect(session.playbackState).toBe('playing');
  });

  it('omits artwork when the track has none', () => {
    renderHook(() => useMediaSession());

    act(() => store().playQueue([track(1)]));

    expect((session.metadata as { init: object }).init).not.toHaveProperty('artwork');
  });

  it('follows pause, and clears everything when the player empties', () => {
    renderHook(() => useMediaSession());
    act(() => store().playQueue([track(1)]));

    act(() => store().pause());
    expect(session.playbackState).toBe('paused');

    act(() => store().clear());
    expect(session.metadata).toBeNull();
    expect(session.playbackState).toBe('none');
  });

  it('lets headphone and lock-screen buttons control playback', () => {
    renderHook(() => useMediaSession());
    act(() => store().playQueue([track(1), track(2)]));

    act(() => handlers.pause?.({}));
    expect(store().wantsPlay).toBe(false);

    act(() => handlers.play?.({}));
    expect(store().wantsPlay).toBe(true);

    act(() => handlers.nexttrack?.({}));
    expect(store().index).toBe(1);

    useProgressStore.getState().update({ positionSec: 1 });
    act(() => handlers.previoustrack?.({}));
    expect(store().index).toBe(0);

    act(() => handlers.seekto?.({ seekTime: 90 }));
    expect(store().seekRequest).toMatchObject({ sec: 90 });
  });

  it('does not start playback that is already running when "play" arrives', () => {
    renderHook(() => useMediaSession());
    act(() => store().playQueue([track(1)]));

    act(() => handlers.play?.({}));

    expect(store().wantsPlay).toBe(true);
  });

  it('removes its handlers when the player goes away', () => {
    const { unmount } = renderHook(() => useMediaSession());

    unmount();

    expect(handlers.play).toBeNull();
    expect(handlers.seekto).toBeNull();
  });

  it('does nothing in a browser without the Media Session API', () => {
    Reflect.deleteProperty(navigator, 'mediaSession');

    expect(() => renderHook(() => useMediaSession())).not.toThrow();
  });
});
