import { cleanup, screen, within } from '@testing-library/react';
import type * as CatalogApiModule from '@/features/catalog/api';
import type * as LibraryApiModule from '@/features/library/api';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '@/features/catalog/api';
import { libraryApi } from '@/features/library/api';
import { ApiRequestError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { makeLibrary, makeProgram, makeProgramDetail, subscription } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { ProgramPage } from './ProgramPage';

vi.mock('@/features/catalog/api', async (original) => ({
  ...(await original<typeof CatalogApiModule>()),
  catalogApi: { taxonomy: vi.fn(), tracks: vi.fn(), track: vi.fn(), programs: vi.fn(), program: vi.fn() },
}));
vi.mock('@/features/library/api', async (original) => ({
  ...(await original<typeof LibraryApiModule>()),
  libraryApi: { get: vi.fn(), program: vi.fn() },
}));

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/catalog/programs/:slug" element={<ProgramPage />} />
    </Routes>,
    { route: '/catalog/programs/back-recovery' },
  );

beforeEach(() => {
  useAuthStore.setState({ status: 'authenticated', user: null, accessToken: 't' });
  vi.mocked(catalogApi.program).mockReset().mockResolvedValue(makeProgramDetail());
  vi.mocked(libraryApi.get).mockReset().mockResolvedValue(makeLibrary());
});
afterEach(cleanup);

describe('ProgramPage', () => {
  it('shows the program, its size, price, and the tracks in order with their lengths', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Back recovery' })).toBeInTheDocument();
    expect(screen.getByText('3 tracks · 30m')).toBeInTheDocument();
    expect(screen.getByText('$9.99 / month')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeEnabled();

    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['1Day one10:00', '2Day two20:00']);
  });

  it('sends a listener who already has the program to their library instead', async () => {
    vi.mocked(libraryApi.get).mockResolvedValue(makeLibrary({ programs: [{ ...makeProgram(), access: subscription({ source: 'PROGRAM_SUBSCRIPTION' }) }] }));
    renderPage();

    expect(await screen.findByRole('link', { name: 'Open in your library' })).toHaveAttribute('href', '/library/programs/p1');
    expect(screen.queryByRole('button', { name: 'Subscribe' })).not.toBeInTheDocument();
  });

  it('says plainly when the program does not exist', async () => {
    vi.mocked(catalogApi.program).mockRejectedValue(new ApiRequestError(404, { statusCode: 404, error: 'Not Found', message: 'x' }));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('could not find that');
    expect(screen.getByRole('link', { name: 'Back to the catalog' })).toHaveAttribute('href', '/catalog?tab=programs');
  });
});
