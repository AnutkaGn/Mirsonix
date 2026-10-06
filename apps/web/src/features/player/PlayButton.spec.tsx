import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlayButton } from './PlayButton';
import { usePlayerStore, type PlayerTrack } from './player.store';

const track = (n: number): PlayerTrack => ({ id: `t${n}`, slug: `track-${n}`, title: `Track ${n}`, durationSec: 600, coverUrl: null });
const tracks = [track(1), track(2), track(3)];
const store = () => usePlayerStore.getState();

beforeEach(() => store().clear());
afterEach(cleanup);

describe('PlayButton', () => {
  it('starts the whole list from the chosen track, so "next" continues through it', () => {
    render(<PlayButton tracks={tracks} index={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(store().queue).toEqual(tracks);
    expect(store().index).toBe(1);
    expect(store().wantsPlay).toBe(true);
  });

  it('pauses and resumes when its own track is the one loaded', () => {
    render(<PlayButton tracks={tracks} index={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    usePlayerStore.setState({ phase: 'ready' });

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(store().wantsPlay).toBe(false);
    expect(store().index).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(store().wantsPlay).toBe(true);
  });

  it('starts its own track instead of pausing when another one is playing', () => {
    render(<PlayButton tracks={tracks} index={2} />);
    act(() => store().playQueue(tracks, 0));

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(store().index).toBe(2);
  });

  it('offers to try again, and does so, when its track failed to load', () => {
    render(<PlayButton tracks={tracks} index={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    act(() => store().setPhase('error'));
    const loadsBefore = store().loadId;

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(store().loadId).toBeGreaterThan(loadsBefore);
    expect(store()).toMatchObject({ phase: 'loading', wantsPlay: true });
  });

  it('does not offer a retry for a track that merely shares the player with a failed one', () => {
    render(<PlayButton tracks={tracks} index={2} />);
    act(() => store().playQueue(tracks, 0));
    act(() => store().setPhase('error'));

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('is disabled when there is nothing to play', () => {
    render(<PlayButton tracks={[]} />);

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('can carry its own label', () => {
    render(<PlayButton tracks={tracks}>Play all</PlayButton>);

    expect(screen.getByRole('button', { name: 'Play all' })).toBeInTheDocument();
  });
});
