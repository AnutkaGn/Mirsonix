import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '@/features/admin/api';
import { catalogApi } from '@/features/catalog/api';
import { ApiRequestError } from '@/lib/api-client';
import { LocationProbe } from '@/test/LocationProbe';
import { makeAdminTrack, makeTaxonomy } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { AdminTrackEditPage } from './AdminTrackEditPage';
import type * as AdminApiModule from '@/features/admin/api';
import type * as CatalogApiModule from '@/features/catalog/api';

vi.mock('@/features/admin/api', async (original) => ({
  ...(await original<typeof AdminApiModule>()),
  adminApi: {
    track: vi.fn(),
    createTrack: vi.fn(),
    updateTrack: vi.fn(),
    publishTrack: vi.fn(),
    archiveTrack: vi.fn(),
    setTrackPrices: vi.fn(),
    audioPreview: vi.fn(),
  },
}));
vi.mock('@/features/catalog/api', async (original) => ({
  ...(await original<typeof CatalogApiModule>()),
  catalogApi: { taxonomy: vi.fn() },
}));

const track = makeAdminTrack({ id: 'abc', title: 'Lung opening', status: 'DRAFT' });

beforeEach(() => {
  for (const fn of Object.values(adminApi))
    vi.mocked(fn as never as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(catalogApi.taxonomy).mockResolvedValue(makeTaxonomy());
  vi.mocked(adminApi.track).mockResolvedValue(track);
});
afterEach(cleanup);

const render = (route: string) =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/admin/tracks/new" element={<AdminTrackEditPage />} />
        <Route path="/admin/tracks/:id" element={<AdminTrackEditPage />} />
      </Routes>
      <LocationProbe />
    </>,
    { route },
  );

describe('AdminTrackEditPage: an existing track', () => {
  it('shows the track in the form, with its status, preview and prices', async () => {
    render('/admin/tracks/abc');

    expect(await screen.findByLabelText('Title')).toHaveValue('Lung opening');
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Listen to the file' })).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly price')).toHaveValue('9.99');
  });

  it('publishes the track', async () => {
    vi.mocked(adminApi.publishTrack).mockResolvedValue({ ...track, status: 'PUBLISHED' });
    render('/admin/tracks/abc');

    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(vi.mocked(adminApi.publishTrack).mock.calls[0]?.[0]).toBe('abc'));
  });

  it("shows the server's reason when publishing is refused", async () => {
    const refusal = new ApiRequestError(422, {
      statusCode: 422,
      error: 'x',
      message: 'A track needs a cover before it can be published',
    });
    vi.mocked(adminApi.publishTrack).mockRejectedValue(refusal);
    render('/admin/tracks/abc');

    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A track needs a cover before it can be published',
    );
  });

  it('saves edits with a PATCH of the form values', async () => {
    vi.mocked(adminApi.updateTrack).mockResolvedValue(track);
    render('/admin/tracks/abc');

    fireEvent.change(await screen.findByLabelText('Title'), {
      target: { value: 'Lung opening II' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(adminApi.updateTrack).toHaveBeenCalled());
    expect(vi.mocked(adminApi.updateTrack).mock.calls[0]?.[0]).toBe('abc');
    expect(vi.mocked(adminApi.updateTrack).mock.calls[0]?.[1]).toMatchObject({
      title: 'Lung opening II',
    });
  });

  it('says so when the track does not exist', async () => {
    vi.mocked(adminApi.track).mockRejectedValue(new ApiRequestError(404, null));
    render('/admin/tracks/abc');

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this');
  });
});

describe('AdminTrackEditPage: a new track', () => {
  it('starts empty, has no status controls or prices yet, and opens the new track once created', async () => {
    const created = makeAdminTrack({ id: 'new-id', title: 'Fresh' });
    vi.mocked(adminApi.createTrack).mockResolvedValue(created);
    render('/admin/tracks/new');

    expect(await screen.findByLabelText('Title')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Monthly price')).not.toBeInTheDocument();

    // A valid form needs an audio upload, which has its own spec; a rejected submit must not call the API.
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(adminApi.createTrack).not.toHaveBeenCalled();
  });
});
