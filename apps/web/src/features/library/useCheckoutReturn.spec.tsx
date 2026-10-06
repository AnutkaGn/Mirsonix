import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPurchase, readPurchase, rememberPurchase } from '@/features/billing/pending-purchase';
import type { Ownership } from './api';
import { useCheckoutReturn } from './useCheckoutReturn';

const owns = (trackIds: string[] = [], programIds: string[] = []): Ownership => ({ trackIds: new Set(trackIds), programIds: new Set(programIds), hasSubscription: true });
const at = (route: string) => ({ wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter> });

beforeEach(() => {
  vi.useFakeTimers();
  clearPurchase();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useCheckoutReturn', () => {
  it('does nothing when the listener did not just come back from checkout', () => {
    const { result } = renderHook(() => useCheckoutReturn(owns()), at('/library'));

    expect(result.current).toMatchObject({ state: 'idle', pollMs: false });
  });

  it('waits and polls while the item bought has not arrived', () => {
    rememberPurchase({ kind: 'TRACK', id: 't1' });
    const { result } = renderHook(() => useCheckoutReturn(owns()), at('/library?checkout=success'));

    expect(result.current).toMatchObject({ state: 'pending', pollMs: 2000 });
  });

  it('is done as soon as the item that was bought is in the library, with no waiting, even if it arrived before the page loaded', () => {
    rememberPurchase({ kind: 'TRACK', id: 't1' });
    const { result } = renderHook(() => useCheckoutReturn(owns(['t1'])), at('/library?checkout=success'));

    expect(result.current).toMatchObject({ state: 'done', pollMs: false });
    expect(readPurchase()).toBeNull();
  });

  it('is not fooled by some other item being in the library', () => {
    rememberPurchase({ kind: 'TRACK', id: 't1' });
    const { result } = renderHook(() => useCheckoutReturn(owns(['t-other'], ['p1'])), at('/library?checkout=success'));

    expect(result.current.state).toBe('pending');
  });

  it('recognises a program purchase by its program id', () => {
    rememberPurchase({ kind: 'PROGRAM', id: 'p1' });
    const { result } = renderHook(() => useCheckoutReturn(owns([], ['p1'])), at('/library?checkout=success'));

    expect(result.current.state).toBe('done');
  });

  it('stops polling and says so after half a minute', () => {
    rememberPurchase({ kind: 'TRACK', id: 't1' });
    const { result } = renderHook(() => useCheckoutReturn(owns()), at('/library?checkout=success'));

    act(() => void vi.advanceTimersByTime(30_000));

    expect(result.current).toMatchObject({ state: 'slow', pollMs: false });
  });

  it('still waits, without knowing what for, when nothing was remembered (a new tab)', () => {
    const { result } = renderHook(() => useCheckoutReturn(owns(['t1'])), at('/library?checkout=success'));

    expect(result.current.state).toBe('pending');
  });

  it('waits for the library to load before judging', () => {
    rememberPurchase({ kind: 'TRACK', id: 't1' });
    const { result } = renderHook(() => useCheckoutReturn(undefined), at('/library?checkout=success'));

    expect(result.current.state).toBe('pending');
  });

  it('can be dismissed, forgetting the purchase and clearing the address', () => {
    rememberPurchase({ kind: 'TRACK', id: 't1' });
    const { result } = renderHook(() => useCheckoutReturn(owns()), at('/library?checkout=success'));

    act(() => result.current.dismiss());

    expect(result.current.state).toBe('idle');
    expect(readPurchase()).toBeNull();
  });
});
