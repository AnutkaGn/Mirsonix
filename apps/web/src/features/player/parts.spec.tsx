import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FullPlayer } from './FullPlayer';
import { MiniPlayer } from './MiniPlayer';
import * as Player from './parts';
import { usePlayerStore, type PlayerTrack } from './player.store';
import { useProgressStore } from './progress.store';

const track = (n: number): PlayerTrack => ({ id: `t${n}`, slug: `track-${n}`, title: `Track ${n}`, durationSec: 600, coverUrl: null });
const tracks = [track(1), track(2), track(3)];
const store = () => usePlayerStore.getState();

beforeEach(() => {
  store().clear();
  usePlayerStore.setState({ playbackRate: 1, loop: 'off' });
  useProgressStore.getState().reset();
});
afterEach(cleanup);

const loadQueue = (index = 0) => act(() => store().playQueue(tracks, index));
/** Radix menus open from the keyboard in jsdom; this is also how a keyboard user opens them. */
const openMenu = (name: string) => {
  const trigger = screen.getByRole('button', { name });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
};

describe('Player.Root', () => {
  it('renders nothing while there is no track', () => {
    const { container } = render(<MiniPlayer />);

    expect(container).toBeEmptyDOMElement();
  });

  it('refuses parts used outside it, instead of failing in a confusing way later', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Player.PlayPause />)).toThrow('inside <Player.Root>');
  });
});

describe('mini player', () => {
  it('shows the current track', () => {
    render(<MiniPlayer />);
    loadQueue(1);

    expect(screen.getByText('Track 2')).toBeInTheDocument();
  });

  describe('play and pause', () => {
    it('offers pause while playing and play while paused, and toggles', () => {
      render(<MiniPlayer />);
      loadQueue();
      usePlayerStore.setState({ phase: 'ready' });

      fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
      expect(store().wantsPlay).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: 'Play' }));
      expect(store().wantsPlay).toBe(true);
    });

    it('says it is busy while the track is buffering', () => {
      render(<MiniPlayer />);
      loadQueue(); // phase: loading

      expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-busy', 'true');
    });

    it('shows what went wrong and lets the listener try again', () => {
      render(<MiniPlayer />);
      loadQueue();
      act(() => store().setPhase('error'));
      const loadsBefore = store().loadId;

      expect(screen.getByRole('alert')).toHaveTextContent('could not be played');
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(store().loadId).toBeGreaterThan(loadsBefore);
      expect(store()).toMatchObject({ phase: 'loading', wantsPlay: true });
    });
  });

  describe('previous and next', () => {
    it('goes to the next track, and cannot go past the last one', () => {
      render(<MiniPlayer />);
      loadQueue(1);

      fireEvent.click(screen.getByRole('button', { name: 'Next track' }));
      expect(store().index).toBe(2);
      expect(screen.getByRole('button', { name: 'Next track' })).toBeDisabled();
    });

    it('lets "next" wrap around when the queue repeats', () => {
      usePlayerStore.setState({ loop: 'all' });
      render(<MiniPlayer />);
      loadQueue(2);

      expect(screen.getByRole('button', { name: 'Next track' })).toBeEnabled();
    });

    it('goes back a track near the start, and restarts the track when it has played a while', () => {
      render(<MiniPlayer />);
      loadQueue(1);

      act(() => useProgressStore.getState().update({ positionSec: 40 }));
      fireEvent.click(screen.getByRole('button', { name: 'Previous track' }));
      expect(store().index).toBe(1);
      expect(store().seekRequest).toMatchObject({ sec: 0 });

      act(() => useProgressStore.getState().update({ positionSec: 1 }));
      fireEvent.click(screen.getByRole('button', { name: 'Previous track' }));
      expect(store().index).toBe(0);
    });
  });
});

describe('Player.Progress', () => {
  const renderProgress = () =>
    render(
      <Player.Root variant="full">
        <Player.Progress />
      </Player.Root>,
    );

  it('shows the position and the length as clock times', () => {
    renderProgress();
    loadQueue();
    act(() => useProgressStore.getState().update({ positionSec: 83, durationSec: 3725 }));

    expect(screen.getByText('1:23')).toBeInTheDocument();
    expect(screen.getByText('1:02:05')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Playback position' })).toHaveAttribute('aria-valuenow', '83');
  });

  it('cannot be moved before the length is known', () => {
    renderProgress();
    loadQueue();

    expect(screen.getByRole('slider', { name: 'Playback position' })).toHaveAttribute('data-disabled');
  });

  it('seeks from the keyboard', () => {
    renderProgress();
    loadQueue();
    act(() => useProgressStore.getState().update({ positionSec: 100, durationSec: 600 }));

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Playback position' }), { key: 'ArrowRight' });

    expect(store().seekRequest).toMatchObject({ sec: 101 });
  });

  it('never shows a position beyond the end', () => {
    renderProgress();
    loadQueue();
    act(() => useProgressStore.getState().update({ positionSec: 700, durationSec: 600 }));

    expect(screen.getByRole('slider', { name: 'Playback position' })).toHaveAttribute('aria-valuenow', '600');
  });
});

describe('Player.Speed', () => {
  it('shows the current speed and changes it', () => {
    render(
      <Player.Root variant="full">
        <Player.Speed />
      </Player.Root>,
    );
    loadQueue();
    expect(screen.getByRole('button', { name: 'Playback speed' })).toHaveTextContent('1×');

    openMenu('Playback speed');
    fireEvent.click(screen.getByRole('menuitemradio', { name: '1.5×' }));

    expect(store().playbackRate).toBe(1.5);
    expect(screen.getByRole('button', { name: 'Playback speed' })).toHaveTextContent('1.5×');
  });
});

describe('Player.SleepTimer', () => {
  const renderTimer = () =>
    render(
      <Player.Root variant="full">
        <Player.SleepTimer />
      </Player.Root>,
    );

  it('sets a timer in minutes, and shows how long is left', () => {
    renderTimer();
    loadQueue();

    openMenu('Sleep timer');
    fireEvent.click(screen.getByRole('menuitemradio', { name: '30 minutes' }));

    expect(store().sleepTimer).toMatchObject({ kind: 'minutes' });
    expect(screen.getByRole('button', { name: 'Sleep timer' })).toHaveTextContent('30 min');
  });

  it('counts down as time passes', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    renderTimer();
    loadQueue();
    act(() => store().setSleepTimer({ minutes: 30 }));

    act(() => void vi.advanceTimersByTime(10 * 60_000));

    expect(screen.getByRole('button', { name: 'Sleep timer' })).toHaveTextContent('20 min');
    vi.useRealTimers();
  });

  it('can be set to the end of the track, and switched off again', () => {
    renderTimer();
    loadQueue();

    openMenu('Sleep timer');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'End of track' }));
    expect(store().sleepTimer).toEqual({ kind: 'end-of-track' });
    expect(screen.getByRole('button', { name: 'Sleep timer' })).toHaveTextContent('End of track');

    openMenu('Sleep timer');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Off' }));
    expect(store().sleepTimer).toBeNull();
  });
});

describe('Player.Loop', () => {
  it('cycles the repeat mode, and says what it is set to', () => {
    render(
      <Player.Root variant="full">
        <Player.Loop />
      </Player.Root>,
    );
    loadQueue();

    expect(screen.getByRole('button', { name: 'Repeat: off' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Repeat: off' }));
    expect(screen.getByRole('button', { name: 'Repeat: all tracks' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Repeat: all tracks' }));
    expect(screen.getByRole('button', { name: 'Repeat: this track' })).toBeInTheDocument();
  });
});

describe('Player.Queue', () => {
  const renderQueue = () =>
    render(
      <Player.Root variant="full">
        <Player.Queue />
      </Player.Root>,
    );

  it('lists the queue, marks the current track, and jumps on click', () => {
    renderQueue();
    loadQueue(1);
    const list = within(screen.getByRole('region', { name: 'Up next' }));

    expect(list.getAllByRole('listitem')).toHaveLength(3);
    expect(list.getByRole('button', { name: /Track 2/ })).toHaveAttribute('aria-current', 'true');

    fireEvent.click(list.getByRole('button', { name: /Track 3/ }));
    expect(store().index).toBe(2);
  });

  it('is left out when there is nothing to choose between', () => {
    renderQueue();
    act(() => store().playQueue([track(1)]));

    expect(screen.queryByRole('region', { name: 'Up next' })).not.toBeInTheDocument();
  });
});

describe('full player', () => {
  it('opens from the mini player and closes again', () => {
    render(
      <>
        <MiniPlayer />
        <FullPlayer />
      </>,
    );
    loadQueue();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open full player' }));
    const dialog = screen.getByRole('dialog', { name: 'Now playing' });
    expect(within(dialog).getByRole('button', { name: 'Playback speed' })).toBeInTheDocument();
    expect(within(dialog).getByRole('region', { name: 'Up next' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close full player' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes with Escape', () => {
    render(<FullPlayer />);
    loadQueue();
    act(() => store().setExpanded(true));

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(store().expanded).toBe(false);
  });

  it('does not open when there is no track', () => {
    render(<FullPlayer />);
    act(() => store().setExpanded(true));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
