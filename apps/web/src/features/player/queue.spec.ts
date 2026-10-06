import { describe, expect, it } from 'vitest';
import { indexAfterEnd, indexForNext, indexForPrevious, nextLoopMode } from './queue';

describe('indexAfterEnd (a track finished by itself)', () => {
  it('moves on to the next track', () => {
    expect(indexAfterEnd(0, 3, 'off')).toBe(1);
    expect(indexAfterEnd(1, 3, 'all')).toBe(2);
  });

  it('stops after the last track unless the queue repeats', () => {
    expect(indexAfterEnd(2, 3, 'off')).toBeNull();
    expect(indexAfterEnd(2, 3, 'all')).toBe(0);
  });

  it('repeats the same track in "one" mode, even the last one', () => {
    expect(indexAfterEnd(1, 3, 'one')).toBe(1);
    expect(indexAfterEnd(2, 3, 'one')).toBe(2);
  });

  it('has nowhere to go with an empty queue', () => {
    expect(indexAfterEnd(0, 0, 'all')).toBeNull();
    expect(indexAfterEnd(0, 0, 'one')).toBeNull();
  });

  it('wraps a single-track queue onto itself in "all" mode', () => {
    expect(indexAfterEnd(0, 1, 'all')).toBe(0);
  });
});

describe('indexForNext (the listener pressed next)', () => {
  it('goes forward', () => {
    expect(indexForNext(0, 3, 'off')).toBe(1);
  });

  it('does nothing at the end of a queue that does not repeat', () => {
    expect(indexForNext(2, 3, 'off')).toBeNull();
  });

  it('wraps around when the queue repeats', () => {
    expect(indexForNext(2, 3, 'all')).toBe(0);
  });

  it('still advances in "one" mode: repeat-one must not trap the listener', () => {
    expect(indexForNext(0, 3, 'one')).toBe(1);
    expect(indexForNext(2, 3, 'one')).toBeNull();
  });
});

describe('indexForPrevious', () => {
  it('goes back', () => {
    expect(indexForPrevious(2, 3, 'off')).toBe(1);
  });

  it('stays on the first track unless the queue repeats', () => {
    expect(indexForPrevious(0, 3, 'off')).toBe(0);
    expect(indexForPrevious(0, 3, 'one')).toBe(0);
    expect(indexForPrevious(0, 3, 'all')).toBe(2);
  });
});

describe('nextLoopMode', () => {
  it('cycles off -> all -> one -> off', () => {
    expect(nextLoopMode('off')).toBe('all');
    expect(nextLoopMode('all')).toBe('one');
    expect(nextLoopMode('one')).toBe('off');
  });
});
