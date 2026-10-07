import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '@/features/admin/api';
import { LocationProbe } from '@/test/LocationProbe';
import { makeAdminTrack, page } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { AdminTracksPage } from './AdminTracksPage';
import type * as AdminApiModule from '@/features/admin/api';

vi.mock('@/features/admin/api', async (original) => ({
  ...(await original<typeof AdminApiModule>()),
  adminApi: { tracks: vi.fn() },
}));

const draft = makeAdminTrack({
  id: 'd',
  title: 'A draft',
  status: 'DRAFT',
  prices: { month: null, year: null },
});
const live = makeAdminTrack({
  id: 'p',
  title: 'A live one',
  status: 'PUBLISHED',
  durationSec: 125,
});

beforeEach(() =>
  vi
    .mocked(adminApi.tracks)
    .mockReset()
    .mockResolvedValue(page([draft, live]) as never),
);
afterEach(cleanup);

const render = (route = '/admin/tracks') =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/admin/tracks" element={<AdminTracksPage />} />
      </Routes>
      <LocationProbe />
    </>,
    { route },
  );

describe('AdminTracksPage', () => {
  it('lists every track with its status, length and price', async () => {
    render();

    const live = await screen.findByRole('link', { name: /A live one/ });
    expect(live).toHaveTextContent('Published');
    expect(live).toHaveTextContent('2:05');
    expect(live).toHaveTextContent('$9.99 / month');
    expect(screen.getByRole('link', { name: /A draft/ })).toHaveTextContent('Not on sale yet');
    expect(live).toHaveAttribute('href', '/admin/tracks/p');
  });

  it('links to the new-track form', async () => {
    render();

    expect(await screen.findByRole('link', { name: 'New track' })).toHaveAttribute(
      'href',
      '/admin/tracks/new',
    );
  });

  it('asks the API for what the URL says', async () => {
    render('/admin/tracks?q=lung&status=DRAFT&page=2');

    await waitFor(() =>
      expect(adminApi.tracks).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'lung', status: 'DRAFT', page: 2 }),
        expect.anything(),
      ),
    );
  });

  it('puts a changed filter in the URL and goes back to the first page', async () => {
    render('/admin/tracks?page=3');
    await screen.findByRole('link', { name: /A live one/ });

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'ARCHIVED' } });

    expect(screen.getByTestId('location')).toHaveTextContent('/admin/tracks?status=ARCHIVED');
  });

  it('says so when there is nothing to show', async () => {
    vi.mocked(adminApi.tracks).mockResolvedValue(page([]) as never);
    render();

    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    vi.mocked(adminApi.tracks).mockRejectedValueOnce(new Error('down'));
    render();

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this');
  });
});
