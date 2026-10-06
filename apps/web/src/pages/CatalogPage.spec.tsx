import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type * as CatalogApiModule from '@/features/catalog/api';
import type * as LibraryApiModule from '@/features/library/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '@/features/catalog/api';
import { libraryApi } from '@/features/library/api';
import { usePlayerStore } from '@/features/player/player.store';
import { useAuthStore } from '@/stores/auth.store';
import { makeLibrary, makeProgram, makeTaxonomy, makeTrack, makeLibrary as library, NO_PRICES, page, subscription } from '@/test/fixtures';
import { LocationProbe } from '@/test/LocationProbe';
import { renderWithProviders } from '@/test/render';
import { CatalogPage } from './CatalogPage';

vi.mock('@/features/catalog/api', async (original) => ({
  ...(await original<typeof CatalogApiModule>()),
  catalogApi: { taxonomy: vi.fn(), tracks: vi.fn(), track: vi.fn(), programs: vi.fn(), program: vi.fn() },
}));
vi.mock('@/features/library/api', async (original) => ({
  ...(await original<typeof LibraryApiModule>()),
  libraryApi: { get: vi.fn(), program: vi.fn() },
}));

const tracks = vi.mocked(catalogApi.tracks);
const programs = vi.mocked(catalogApi.programs);
const lastTracksQuery = () => tracks.mock.calls.at(-1)?.[0];

const renderPage = (route = '/catalog') =>
  renderWithProviders(
    <>
      <CatalogPage />
      <LocationProbe />
    </>,
    { route },
  );

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useAuthStore.setState({ status: 'authenticated', user: null, accessToken: 't' });
  usePlayerStore.getState().clear();
  tracks.mockReset().mockResolvedValue(page([makeTrack(), makeTrack({ id: 't2', slug: 'night-tide', title: 'Night tide' })]));
  programs.mockReset().mockResolvedValue(page([makeProgram()]));
  vi.mocked(catalogApi.taxonomy).mockReset().mockResolvedValue(makeTaxonomy());
  vi.mocked(libraryApi.get).mockReset().mockResolvedValue(makeLibrary());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('tracks', () => {
  it('lists the tracks with what each costs, linking to its page', async () => {
    renderPage();

    const link = await screen.findByRole('link', { name: 'Lung opening' });

    expect(link).toHaveAttribute('href', '/catalog/tracks/lung-opening');
    expect(screen.getAllByText('$9.99 / month')).toHaveLength(2);
    expect(screen.getAllByText('$99.00 / year')).toHaveLength(2);
    expect(screen.getAllByText('10:00 · 432 Hz · Sine')).not.toHaveLength(0);
  });

  it('says so when a track is not on sale', async () => {
    tracks.mockResolvedValue(page([makeTrack({ prices: NO_PRICES })]));
    renderPage();

    expect(await screen.findByText('Not on sale yet')).toBeInTheDocument();
  });

  it('marks what the listener already has, and offers to play it instead of the price', async () => {
    vi.mocked(libraryApi.get).mockResolvedValue(library({ tracks: [{ ...makeTrack(), access: subscription() }] }));
    renderPage();

    const card = (await screen.findByRole('link', { name: 'Lung opening' })).closest('article') as HTMLElement;

    expect(await within(card).findByText('In your library')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(within(card).queryByText('$9.99 / month')).not.toBeInTheDocument();
  });

  it('shows placeholders while loading', () => {
    tracks.mockReturnValue(new Promise(() => undefined));
    const { container } = renderPage();

    expect(container.querySelectorAll('[aria-hidden].animate-pulse')).toHaveLength(8);
  });

  it('shows an error that can be retried', async () => {
    tracks.mockRejectedValueOnce(new Error('offline'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('could not load the catalog');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'Lung opening' })).toBeInTheDocument();
  });

  it('tells apart an empty catalog from a search that found nothing', async () => {
    tracks.mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();

    cleanup();
    renderPage('/catalog?wave=SINE');
    expect(await screen.findByText('Nothing matches these filters.')).toBeInTheDocument();
  });
});

describe('filters', () => {
  it('starts from the filters in the address', async () => {
    renderPage('/catalog?wave=BINAURAL&q=sleep&page=2');
    await screen.findByRole('link', { name: 'Lung opening' });

    expect(lastTracksQuery()).toMatchObject({ wave: 'BINAURAL', q: 'sleep', page: 2, limit: 12 });
    expect(screen.getByLabelText('Wave type')).toHaveValue('BINAURAL');
    expect(screen.getByRole('searchbox', { name: 'Search by title' })).toHaveValue('sleep');
  });

  it('puts a chosen filter in the address, back on page one', async () => {
    renderPage('/catalog?page=3');
    await screen.findByRole('link', { name: 'Lung opening' });

    fireEvent.change(screen.getByLabelText('Wave type'), { target: { value: 'SINE' } });

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/catalog?wave=SINE'));
    expect(lastTracksQuery()).toMatchObject({ wave: 'SINE', page: 1 });
  });

  it('offers the elements, meridians and issues from the taxonomy', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Lung opening' });

    expect(within(screen.getByRole('combobox', { name: 'Meridian' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['Any', 'Liver', 'Lung', 'Governing Vessel']);
    expect(within(screen.getByRole('combobox', { name: 'Helps with' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['Any', 'Sleep']);
  });

  it('waits for a pause in typing before searching', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Lung opening' });
    tracks.mockClear();

    const box = screen.getByRole('searchbox', { name: 'Search by title' });
    fireEvent.change(box, { target: { value: 'sl' } });
    fireEvent.change(box, { target: { value: 'sleep' } });
    act(() => void vi.advanceTimersByTime(299));
    expect(tracks).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1));
    await waitFor(() => expect(lastTracksQuery()).toMatchObject({ q: 'sleep' }));
    expect(tracks).toHaveBeenCalledTimes(1);
    expect(box).toHaveValue('sleep');
  });

  it('clears every filter at once', async () => {
    renderPage('/catalog?wave=SINE&issue=sleep&q=x');
    await screen.findByRole('link', { name: 'Lung opening' });

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/catalog$/));
    expect(screen.getByRole('searchbox', { name: 'Search by title' })).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('keeps the old results on screen while the next ones load', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Lung opening' });
    tracks.mockReturnValue(new Promise(() => undefined));

    fireEvent.change(screen.getByLabelText('Wave type'), { target: { value: 'SINE' } });

    expect(screen.getByRole('link', { name: 'Lung opening' })).toBeInTheDocument();
  });
});

describe('paging', () => {
  it('moves between pages through the address', async () => {
    tracks.mockResolvedValue(page([makeTrack()], { page: 1, totalPages: 3, total: 30 }));
    renderPage();
    await screen.findByText('Page 1 of 3');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/catalog?page=2'));
    expect(lastTracksQuery()).toMatchObject({ page: 2 });
  });

  it('shows no pager for a single page', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Lung opening' });

    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });
});

describe('programs tab', () => {
  it('lists programs with their size and price', async () => {
    renderPage('/catalog?tab=programs');

    const link = await screen.findByRole('link', { name: 'Back recovery' });

    expect(link).toHaveAttribute('href', '/catalog/programs/back-recovery');
    expect(screen.getByText('3 tracks · 30m')).toBeInTheDocument();
    expect(screen.getByText('$9.99 / month')).toBeInTheDocument();
  });

  it('switches tabs through the address', async () => {
    renderPage('/catalog?wave=SINE');
    await screen.findByRole('link', { name: 'Lung opening' });

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Programs' }));
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Programs' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('tab', { name: 'Programs' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/catalog?tab=programs'));
    expect(await screen.findByRole('link', { name: 'Back recovery' })).toBeInTheDocument();
  });

  it('marks a program the listener holds', async () => {
    vi.mocked(libraryApi.get).mockResolvedValue(library({ programs: [{ ...makeProgram(), access: subscription({ source: 'PROGRAM_SUBSCRIPTION' }) }] }));
    renderPage('/catalog?tab=programs');

    expect(await screen.findByText('In your library')).toBeInTheDocument();
  });
});

describe('returning from a cancelled checkout', () => {
  it('reassures the listener, and can be dismissed', async () => {
    renderPage('/catalog?checkout=cancelled');

    expect(await screen.findByRole('status')).toHaveTextContent('You have not been charged');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/catalog$/);
  });
});
