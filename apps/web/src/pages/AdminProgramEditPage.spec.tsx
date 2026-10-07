import type { AdminProgramDetail } from '@mirsonix/shared';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AdminApiModule from '@/features/admin/api';
import { adminApi } from '@/features/admin/api';
import { ApiRequestError } from '@/lib/api-client';
import { LocationProbe } from '@/test/LocationProbe';
import { makeAdminTrack, makeProgram, page } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { AdminProgramEditPage } from './AdminProgramEditPage';

vi.mock('@/features/admin/api', async (original) => ({
  ...(await original<typeof AdminApiModule>()),
  adminApi: {
    program: vi.fn(),
    createProgram: vi.fn(),
    updateProgram: vi.fn(),
    setProgramTracks: vi.fn(),
    publishProgram: vi.fn(),
    archiveProgram: vi.fn(),
    setProgramPrices: vi.fn(),
    tracks: vi.fn(),
  },
}));

const program: AdminProgramDetail = {
  ...makeProgram({ id: 'prog', title: 'Back recovery', trackCount: 1 }),
  status: 'DRAFT',
  posterAssetId: null,
  publishedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  tracks: [makeAdminTrack({ id: 'one', title: 'Day one' })],
};

beforeEach(() => {
  for (const fn of Object.values(adminApi))
    vi.mocked(fn as never as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(adminApi.program).mockResolvedValue(program);
  vi.mocked(adminApi.tracks).mockResolvedValue(page([]) as never);
});
afterEach(cleanup);

const render = (route: string) =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/admin/programs/new" element={<AdminProgramEditPage />} />
        <Route path="/admin/programs/:id" element={<AdminProgramEditPage />} />
      </Routes>
      <LocationProbe />
    </>,
    { route },
  );

describe('AdminProgramEditPage', () => {
  it('shows the program with its builder and prices', async () => {
    render('/admin/programs/prog');

    expect(await screen.findByLabelText('Title')).toHaveValue('Back recovery');
    expect(screen.getByText('Day one')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly price')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('saves the order of tracks through the full-list endpoint', async () => {
    vi.mocked(adminApi.setProgramTracks).mockResolvedValue(program);
    vi.mocked(adminApi.tracks).mockResolvedValue(
      page([makeAdminTrack({ id: 'two', title: 'Day two', status: 'PUBLISHED' })]) as never,
    );
    render('/admin/programs/prog');

    fireEvent.click(await screen.findByRole('button', { name: 'Add “Day two” to the program' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save track order' }));

    await waitFor(() => expect(adminApi.setProgramTracks).toHaveBeenCalled());
    expect(vi.mocked(adminApi.setProgramTracks).mock.calls[0]?.slice(0, 2)).toEqual([
      'prog',
      { trackIds: ['one', 'two'] },
    ]);
  });

  it("shows the server's reason when publishing is refused", async () => {
    const refusal = new ApiRequestError(422, {
      statusCode: 422,
      error: 'x',
      message: 'A program needs a poster before it can be published',
    });
    vi.mocked(adminApi.publishProgram).mockRejectedValue(refusal);
    render('/admin/programs/prog');

    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A program needs a poster before it can be published',
    );
  });

  it('creates a program and then opens it, so tracks can be added', async () => {
    vi.mocked(adminApi.createProgram).mockResolvedValue({ ...program, id: 'created' });
    render('/admin/programs/new');

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Back recovery' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Seven days.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/admin/programs/created'),
    );
    expect(
      await screen.findByRole('heading', { name: 'Tracks in this program' }),
    ).toBeInTheDocument();
  });

  it('offers no builder or prices before the program exists', async () => {
    render('/admin/programs/new');

    await screen.findByLabelText('Title');
    expect(screen.queryByText('Tracks in this program')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Monthly price')).not.toBeInTheDocument();
  });
});
