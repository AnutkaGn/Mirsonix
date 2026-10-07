import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api-client';
import { makeAdminTrack, page } from '@/test/fixtures';
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

const one = makeAdminTrack({ id: 'one', title: 'Day one' });
const two = makeAdminTrack({ id: 'two', title: 'Day two' });
const three = makeAdminTrack({ id: 'three', title: 'Day three', status: 'PUBLISHED' });
const archived = makeAdminTrack({ id: 'old', title: 'Old one', status: 'ARCHIVED' });

const order = () =>
  screen
    .getAllByRole('listitem')
    .filter((li) => /^\d/.test(li.textContent ?? ''))
    .map((li) =>
      li.textContent
        ?.replace(/^\d+/, '')
        .replace(/(Draft|Published|Archived).*/, '')
        .trim(),
    );

beforeEach(() => {
  vi.mocked(adminApi.tracks)
    .mockReset()
    .mockResolvedValue(page([one, two, three, archived]) as never);
  vi.mocked(adminApi.createTrack).mockReset();
});
afterEach(cleanup);

const setup = (saved = [one, two], onSave = vi.fn().mockResolvedValue({})) => {
  renderWithProviders(<ProgramBuilder saved={saved} busy={false} onSave={onSave} />);
  return onSave;
};
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save track order' }));

describe('ProgramBuilder', () => {
  it('lists the saved tracks in order, with nothing to save yet', () => {
    setup();

    expect(order()).toEqual(['Day one', 'Day two']);
    expect(screen.getByRole('button', { name: 'Save track order' })).toBeDisabled();
  });

  it('reorders and saves the full ordered list', async () => {
    const onSave = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Move “Day two” up' }));
    expect(order()).toEqual(['Day two', 'Day one']);
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['two', 'one']));
  });

  it('cannot move the first track up or the last one down', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Move “Day one” up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move “Day two” down' })).toBeDisabled();
  });

  it('removes a track', async () => {
    const onSave = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Remove “Day one”' }));
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['two']));
  });

  it('offers existing tracks that are not in the program yet, but not archived ones', async () => {
    setup();

    expect(
      await screen.findByRole('button', { name: 'Add “Day three” to the program' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add “Old one”/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add “Day one”/ })).not.toBeInTheDocument();
  });

  it('adds an existing track at the end', async () => {
    const onSave = setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Add “Day three” to the program' }));
    expect(order()).toEqual(['Day one', 'Day two', 'Day three']);
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['one', 'two', 'three']));
  });

  it('searches the library as the admin types', async () => {
    setup();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'three' } });

    await waitFor(() =>
      expect(adminApi.tracks).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'three' }),
        expect.anything(),
      ),
    );
  });

  it("shows the server's reason when the list is refused", async () => {
    const error = new ApiRequestError(422, {
      statusCode: 422,
      error: 'x',
      message: 'Only published tracks can be in a published program',
    });
    setup([one], vi.fn().mockRejectedValue(error));

    fireEvent.click(await screen.findByRole('button', { name: 'Add “Day three” to the program' }));
    save();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only published tracks can be in a published program',
    );
  });

  it('invites the admin to add a first track when the program is empty', () => {
    setup([]);

    expect(screen.getByText(/No tracks yet/)).toBeInTheDocument();
  });
});
