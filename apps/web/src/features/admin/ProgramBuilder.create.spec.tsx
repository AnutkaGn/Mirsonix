import type { CreateTrackInput } from '@mirsonix/shared';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api-client';
import { makeAdminTrack, makeTaxonomy, page } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { adminApi } from './api';
import { ProgramBuilder } from './ProgramBuilder';
import type * as AdminApiModule from './api';
import type * as CatalogApiModule from '@/features/catalog/api';

vi.mock('./api', async (original) => ({
  ...(await original<typeof AdminApiModule>()),
  adminApi: { tracks: vi.fn(), createTrack: vi.fn() },
}));
vi.mock('@/features/catalog/api', async (original) => ({
  ...(await original<typeof CatalogApiModule>()),
  catalogApi: { taxonomy: vi.fn() },
}));
// The form has its own spec; here only what the builder does with its submitted input matters.
vi.mock('./TrackForm', () => ({
  TrackForm: ({
    onSubmit,
    submitLabel,
  }: {
    onSubmit: (input: CreateTrackInput) => void;
    submitLabel: string;
  }) => (
    <button type="button" onClick={() => onSubmit({ title: 'Fresh track' } as CreateTrackInput)}>
      {submitLabel}
    </button>
  ),
}));

beforeEach(async () => {
  const { catalogApi } = await import('@/features/catalog/api');
  vi.mocked(catalogApi.taxonomy).mockResolvedValue(makeTaxonomy());
  vi.mocked(adminApi.tracks)
    .mockReset()
    .mockResolvedValue(page([]) as never);
  vi.mocked(adminApi.createTrack).mockReset();
});
afterEach(cleanup);

const open = async () => {
  renderWithProviders(<ProgramBuilder saved={[]} busy={false} onSave={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Upload a new track' }));
  return screen.findByRole('button', { name: 'Create and add' });
};

describe('uploading a new track from the builder', () => {
  it('creates the track, adds it to the end of the list and closes the dialog', async () => {
    vi.mocked(adminApi.createTrack).mockResolvedValue(
      makeAdminTrack({ id: 'fresh', title: 'Fresh track' }),
    );

    fireEvent.click(await open());

    expect(await screen.findByText('Fresh track')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(vi.mocked(adminApi.createTrack).mock.calls[0]?.[0]).toEqual({ title: 'Fresh track' });
    expect(screen.getByRole('button', { name: 'Save track order' })).toBeEnabled();
  });

  it('keeps the dialog open and explains a failure, adding nothing', async () => {
    vi.mocked(adminApi.createTrack).mockRejectedValue(new ApiRequestError(503, null));

    fireEvent.click(await open());

    expect(await screen.findByRole('alert')).toHaveTextContent('Payments are not configured');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/No tracks yet/)).toBeInTheDocument();
  });
});
