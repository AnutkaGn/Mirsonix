import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type * as LibraryApiModule from '@/features/library/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { billingApi } from '@/features/billing/api';
import { clearPurchase, rememberPurchase } from '@/features/billing/pending-purchase';
import { libraryApi } from '@/features/library/api';
import { usePlayerStore } from '@/features/player/player.store';
import { ApiRequestError } from '@/lib/api-client';
import { redirectTo } from '@/lib/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { makeLibrary, makeProgram, makeTrack, subscription } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { LibraryPage } from './LibraryPage';

vi.mock('@/features/library/api', async (original) => ({
  ...(await original<typeof LibraryApiModule>()),
  libraryApi: { get: vi.fn(), program: vi.fn() },
}));
vi.mock('@/features/billing/api', () => ({ billingApi: { checkout: vi.fn(), portal: vi.fn() } }));
vi.mock('@/lib/navigation', () => ({ redirectTo: vi.fn() }));

const get = vi.mocked(libraryApi.get);
const withTracks = () =>
  makeLibrary({
    tracks: [
      { ...makeTrack({ id: 't1', slug: 'alpha', title: 'Alpha' }), access: subscription() },
      { ...makeTrack({ id: 't2', slug: 'beta', title: 'Beta' }), access: subscription({ cancelAtPeriodEnd: true }) },
    ],
    programs: [{ ...makeProgram(), access: subscription({ source: 'PROGRAM_SUBSCRIPTION' }) }],
  });

beforeEach(() => {
  useAuthStore.setState({ status: 'authenticated', user: null, accessToken: 't' });
  usePlayerStore.getState().clear();
  clearPurchase();
  get.mockReset().mockResolvedValue(withTracks());
  vi.mocked(billingApi.portal).mockReset();
  vi.mocked(redirectTo).mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LibraryPage', () => {
  it('invites a listener with nothing to browse the catalog', async () => {
    get.mockResolvedValue(makeLibrary());
    renderWithProviders(<LibraryPage />);

    expect(await screen.findByText('Your library is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the catalog' })).toHaveAttribute('href', '/catalog');
    expect(screen.queryByRole('button', { name: 'Manage subscriptions' })).not.toBeInTheDocument();
  });

  it('lists programs and tracks, each with where its access stands', async () => {
    renderWithProviders(<LibraryPage />);

    const programs = within(await screen.findByRole('region', { name: 'Programs' }));
    expect(programs.getByText('Back recovery')).toBeInTheDocument();
    expect(programs.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/library/programs/p1');
    expect(programs.getByText('Renews on Dec 1, 2026')).toBeInTheDocument();

    const tracks = within(screen.getByRole('region', { name: 'Tracks' }));
    expect(tracks.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/catalog/tracks/alpha');
    expect(tracks.getByText('Renews on Dec 1, 2026')).toBeInTheDocument();
    expect(tracks.getByText('Access ends on Dec 1, 2026')).toBeInTheDocument();
  });

  it('plays the track chosen and queues the rest of the library after it', async () => {
    renderWithProviders(<LibraryPage />);
    const tracks = within(await screen.findByRole('region', { name: 'Tracks' }));

    fireEvent.click(tracks.getAllByRole('button', { name: 'Play' })[1]!);

    const player = usePlayerStore.getState();
    expect(player.queue.map((item) => item.id)).toEqual(['t1', 't2']);
    expect(player.index).toBe(1);
  });

  it('shows an error that can be retried', async () => {
    get.mockRejectedValueOnce(new Error('offline'));
    renderWithProviders(<LibraryPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not load your library');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('region', { name: 'Tracks' })).toBeInTheDocument();
  });

  describe('managing billing', () => {
    it('offers the billing portal to someone who pays, and goes to it', async () => {
      vi.mocked(billingApi.portal).mockResolvedValue({ url: 'https://portal.stripe.test/p/1' });
      renderWithProviders(<LibraryPage />);

      fireEvent.click(await screen.findByRole('button', { name: 'Manage subscriptions' }));

      await waitFor(() => expect(redirectTo).toHaveBeenCalledWith('https://portal.stripe.test/p/1'));
    });

    it('does not offer it to someone who only has gifts', async () => {
      get.mockResolvedValue(makeLibrary({ tracks: [{ ...makeTrack(), access: subscription({ source: 'GRANT', validUntil: null }) }] }));
      renderWithProviders(<LibraryPage />);

      expect(await screen.findByText('Included for you')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Manage subscriptions' })).not.toBeInTheDocument();
    });

    it('explains a failure to open the portal', async () => {
      vi.mocked(billingApi.portal).mockRejectedValue(new ApiRequestError(503, { statusCode: 503, error: 'x', message: 'x' }));
      renderWithProviders(<LibraryPage />);

      fireEvent.click(await screen.findByRole('button', { name: 'Manage subscriptions' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    });
  });

  describe('coming back from checkout', () => {
    it('waits, and keeps checking, until the new item shows up', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      rememberPurchase({ kind: 'TRACK', id: 't-new' });
      get.mockResolvedValue(withTracks());
      renderWithProviders(<LibraryPage />, { route: '/library?checkout=success' });

      expect(await screen.findByRole('status')).toHaveTextContent('Payment received');
      const callsBefore = get.mock.calls.length;

      get.mockResolvedValue(makeLibrary({ tracks: [...withTracks().tracks, { ...makeTrack({ id: 't-new', slug: 'new', title: 'New one' }), access: subscription() }] }));
      await act(async () => void vi.advanceTimersByTime(2100));

      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Your subscription is active'));
      expect(get.mock.calls.length).toBeGreaterThan(callsBefore);
      expect(screen.getByRole('link', { name: 'New one' })).toBeInTheDocument();
    });

    it('tells the listener it is taking long, and stops polling, after half a minute', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      rememberPurchase({ kind: 'TRACK', id: 't-new' });
      renderWithProviders(<LibraryPage />, { route: '/library?checkout=success' });
      await screen.findByRole('status');

      await act(async () => void vi.advanceTimersByTime(30_100));

      expect(screen.getByRole('status')).toHaveTextContent('Still waiting');
      const callsThen = get.mock.calls.length;
      await act(async () => void vi.advanceTimersByTime(10_000));
      expect(get.mock.calls.length).toBe(callsThen);
    });

    it('can be dismissed', async () => {
      rememberPurchase({ kind: 'TRACK', id: 't-new' });
      renderWithProviders(<LibraryPage />, { route: '/library?checkout=success' });

      fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));

      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    });

    it('shows no banner on an ordinary visit', async () => {
      renderWithProviders(<LibraryPage />);
      await screen.findByRole('region', { name: 'Tracks' });

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
