import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAdminTrack, page } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { adminApi } from './api';
import { GrantForm } from './GrantForm';
import type * as AdminApiModule from './api';

vi.mock('./api', async (original) => ({
  ...(await original<typeof AdminApiModule>()),
  adminApi: { tracks: vi.fn(), programs: vi.fn() },
}));

const track = makeAdminTrack({ title: 'Lung opening', status: 'PUBLISHED' });

beforeEach(() => {
  vi.mocked(adminApi.tracks)
    .mockReset()
    .mockResolvedValue(page([track]) as never);
  vi.mocked(adminApi.programs)
    .mockReset()
    .mockResolvedValue(page([]) as never);
});
afterEach(cleanup);

const setup = () => {
  const onSubmit = vi.fn();
  renderWithProviders(<GrantForm busy={false} onSubmit={onSubmit} />);
  return onSubmit;
};
const give = () => fireEvent.click(screen.getByRole('button', { name: 'Give access' }));

describe('GrantForm', () => {
  it('needs an email and an item', () => {
    const onSubmit = setup();

    give();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Listener email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Item')).toHaveAttribute('aria-invalid', 'true');
  });

  it('only offers published items', async () => {
    setup();

    await screen.findByRole('option', { name: 'Lung opening' });
    expect(adminApi.tracks).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PUBLISHED' }),
      expect.anything(),
    );
  });

  it('submits a track grant with a normalised email and an end-of-day expiry', async () => {
    const onSubmit = setup();
    await screen.findByRole('option', { name: 'Lung opening' });

    fireEvent.change(screen.getByLabelText('Listener email'), {
      target: { value: '  Friend@Example.com ' },
    });
    fireEvent.change(screen.getByLabelText('Item'), { target: { value: track.id } });
    fireEvent.change(screen.getByLabelText('Expires on'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Press copy' } });
    give();

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const input = onSubmit.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      userEmail: 'friend@example.com',
      trackId: track.id,
      source: 'ADMIN',
      note: 'Press copy',
    });
    expect(new Date(input.expiresAt).getTime()).toBe(new Date('2026-12-31T23:59:59').getTime());
  });

  it('leaves out the expiry when none is chosen', async () => {
    const onSubmit = setup();
    await screen.findByRole('option', { name: 'Lung opening' });

    fireEvent.change(screen.getByLabelText('Listener email'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Item'), { target: { value: track.id } });
    give();

    expect(onSubmit.mock.calls[0]?.[0].expiresAt).toBeUndefined();
  });

  it('clears the chosen item when switching between track and program', async () => {
    setup();
    await screen.findByRole('option', { name: 'Lung opening' });
    fireEvent.change(screen.getByLabelText('Item'), { target: { value: track.id } });

    fireEvent.change(screen.getByLabelText('Gives access to'), { target: { value: 'programId' } });

    expect(screen.getByLabelText('Item')).toHaveValue('');
    expect(screen.queryByRole('option', { name: 'Lung opening' })).not.toBeInTheDocument();
  });
});
