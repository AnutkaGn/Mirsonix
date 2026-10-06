import { afterEach, describe, expect, it, vi } from 'vitest';
import { followSystemColorScheme } from './theme';

function fakeMediaQuery(matches: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  return { change: (next: boolean) => { query.matches = next; listeners.forEach((listener) => listener()); }, listeners };
}

afterEach(() => {
  document.documentElement.classList.remove('dark');
  vi.unstubAllGlobals();
});

describe('followSystemColorScheme', () => {
  it('uses the dark theme when the system does', () => {
    fakeMediaQuery(true);
    followSystemColorScheme();

    expect(document.documentElement).toHaveClass('dark');
  });

  it('stays light when the system is light', () => {
    fakeMediaQuery(false);
    followSystemColorScheme();

    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('changes live when the system setting changes, and stops when told to', () => {
    const system = fakeMediaQuery(false);
    const stop = followSystemColorScheme();

    system.change(true);
    expect(document.documentElement).toHaveClass('dark');

    stop();
    expect(system.listeners.size).toBe(0);
  });

  it('does nothing where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(() => followSystemColorScheme()()).not.toThrow();
  });
});
