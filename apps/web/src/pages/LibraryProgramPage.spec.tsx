import { cleanup, fireEvent, screen } from '@testing-library/react';
import type * as LibraryApiModule from '@/features/library/api';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { libraryApi } from '@/features/library/api';
import { usePlayerStore } from '@/features/player/player.store';
import { ApiRequestError } from '@/lib/api-client';
import { makeProgramDetail, subscription } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { LibraryProgramPage } from './LibraryProgramPage';

vi.mock('@/features/library/api', async (original) => ({
  ...(await original<typeof LibraryApiModule>()),
  libraryApi: { get: vi.fn(), program: vi.fn() },
}));

const program = vi.mocked(libraryApi.program);
const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/library/programs/:id" element={<LibraryProgramPage />} />
    </Routes>,
    { route: '/library/programs/p1' },
  );

beforeEach(() => {
  usePlayerStore.getState().clear();
  program.mockReset().mockResolvedValue({ ...makeProgramDetail(), access: subscription({ source: 'PROGRAM_SUBSCRIPTION', cancelAtPeriodEnd: true }) });
});
afterEach(cleanup);

describe('LibraryProgramPage', () => {
  it('shows the program, where its access stands, and its tracks in order', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Back recovery' })).toBeInTheDocument();
    expect(screen.getByText('Access ends on Dec 1, 2026')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Day one'), expect.stringContaining('Day two')]),
    );
  });

  it('plays the whole program from the start, with the program as the context of each listen', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Play all' }));

    const player = usePlayerStore.getState();
    expect(player.queue.map((item) => [item.id, item.programId])).toEqual([['t1', 'p1'], ['t2', 'p1']]);
    expect(player.index).toBe(0);
  });

  it('starts from the track chosen, continuing through the rest', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1 });

    fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[1]!);

    expect(usePlayerStore.getState().index).toBe(1);
  });

  it('says so, and points back to the library, when the listener does not have this program', async () => {
    program.mockRejectedValue(new ApiRequestError(403, { statusCode: 403, error: 'Forbidden', message: 'x' }));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('do not have access');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Library' })).toHaveAttribute('href', '/library');
  });

  it('offers a retry for a failure that may pass', async () => {
    program.mockRejectedValue(new ApiRequestError(500, { statusCode: 500, error: 'x', message: 'x' }));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('could not load your library');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
