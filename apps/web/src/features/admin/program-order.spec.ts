import { describe, expect, it } from 'vitest';
import { appendUnique, moveItem, removeItem, sameOrder } from './program-order';

describe('moveItem', () => {
  it('moves an item up and down', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it('leaves the list alone at either end', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('ignores an index that does not exist', () => {
    expect(moveItem(['a'], 5, -1)).toEqual(['a']);
    expect(moveItem(['a'], -1, 1)).toEqual(['a']);
  });

  it('does not mutate its input', () => {
    const list = ['a', 'b'];
    moveItem(list, 0, 1);
    expect(list).toEqual(['a', 'b']);
  });
});

describe('removeItem / appendUnique / sameOrder', () => {
  it('removes by position', () => {
    expect(removeItem(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });

  it('appends a new id and ignores a repeat', () => {
    expect(appendUnique(['a'], 'b')).toEqual(['a', 'b']);
    expect(appendUnique(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });

  it('compares order, not just membership', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameOrder(['a'], ['a', 'b'])).toBe(false);
  });
});
