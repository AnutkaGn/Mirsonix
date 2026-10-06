import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type * as CatalogApiModule from '@/features/catalog/api';
import type * as LibraryApiModule from '@/features/library/api';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '@/features/catalog/api';
import { libraryApi } from '@/features/library/api';
import { usePlayerStore } from '@/features/player/player.store';
import { ApiRequestError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { makeLibrary, makeTrack, NO_PRICES, subscription } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { TrackPage } from './TrackPage';

vi.mock('@/features/catalog/api', async (original) => ({
  ...(await original<typeof CatalogApiModule>()),
  catalogApi: { taxonomy: vi.fn(), tracks: vi.fn(), track: vi.fn(), programs: vi.fn(), program: vi.fn() },
}));
vi.mock('@/features/library/api', async (original) => ({
  ...(await original<typeof LibraryApiModule>()),
  libraryApi: { get: vi.fn(), program: vi.fn() },
}));

const track = vi.mocked(catalogApi.track);
const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/catalog/tracks/:slug" element={<TrackPage />} />
    </Routes>,
    { route: '/catalog/tracks/lung-opening' },
  );

beforeEach(() => {
  useAuthStore.setState({ status: 'authenticated', user: null, accessToken: 't' });
  usePlayerStore.getState().clear();
  track.mockReset().mockResolvedValue(makeTrack());
  vi.mocked(libraryApi.get).mockReset().mockResolvedValue(makeLibrary());
});
afterEach(cleanup);

describe('TrackPage', () => {
  it('shows the track, what it targets and what it costs, with a way to subscribe', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Lung opening' })).toBeInTheDocument();
    expect(screen.getByText('Slow breathing for the Lung meridian.')).toBeInTheDocument();
    expect(screen.getByText('10:00 · 432 Hz · Sine')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Meridians' })).getByText('Lung')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Helps with' })).getByText('Sleep')).toBeInTheDocument();
    expect(screen.getByText('$9.99 / month')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeEnabled();
  });

  it('cannot be subscribed to while nothing is on sale', async () => {
    track.mockResolvedValue(makeTrack({ prices: NO_PRICES }));
    renderPage();

    expect(await screen.findByRole('button', { name: 'Not on sale yet' })).toBeDisabled();
  });

  it('leaves out sections the track does not have', async () => {
    track.mockResolvedValue(makeTrack({ meridians: [], issues: [], frequencyHz: null, waveType: null }));
    renderPage();
    await screen.findByRole('heading', { level: 1 });

    expect(screen.queryByRole('region', { name: 'Meridians' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Helps with' })).not.toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });

  it('offers to play, not to subscribe, a track the listener already has', async () => {
    vi.mocked(libraryApi.get).mockResolvedValue(makeLibrary({ tracks: [{ ...makeTrack(), access: subscription() }] }));
    renderPage();

    const play = await screen.findByRole('button', { name: 'Play' });
    expect(screen.queryByRole('button', { name: 'Subscribe' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in your library' })).toHaveAttribute('href', '/library');

    fireEvent.click(play);
    expect(usePlayerStore.getState().queue.map((item) => item.id)).toEqual(['t1']);
    expect(usePlayerStore.getState().wantsPlay).toBe(true);
  });

  it('says plainly when the track does not exist, without offering a pointless retry', async () => {
    track.mockRejectedValue(new ApiRequestError(404, { statusCode: 404, error: 'Not Found', message: 'Track not found' }));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('could not find that');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the catalog' })).toHaveAttribute('href', '/catalog');
  });

  it('offers a retry when the failure may pass', async () => {
    track.mockRejectedValueOnce(new Error('offline'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('could not load the catalog');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Lung opening' })).toBeInTheDocument();
  });
});
