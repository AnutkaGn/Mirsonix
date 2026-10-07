import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AdminApiModule from './api';
import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { adminApi } from './api';
import { AudioPreview } from './AudioPreview';

vi.mock('./api', async (original) => ({
  ...(await original<typeof AdminApiModule>()),
  adminApi: { audioPreview: vi.fn() },
}));

beforeEach(() => vi.mocked(adminApi.audioPreview).mockReset());
afterEach(cleanup);

describe('AudioPreview', () => {
  it('asks for a signed link only when the admin wants to listen, then plays it', async () => {
    vi.mocked(adminApi.audioPreview).mockResolvedValue({
      url: 'https://s3.test/audio?sig=1',
      expiresIn: 600,
    });
    renderWithProviders(<AudioPreview trackId="t1" />);
    expect(adminApi.audioPreview).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Listen to the file' }));

    const player = await screen.findByLabelText('Listen to the file', { selector: 'audio' });
    expect(player).toHaveAttribute('src', 'https://s3.test/audio?sig=1');
    expect(vi.mocked(adminApi.audioPreview).mock.calls[0]?.[0]).toBe('t1');
  });

  it('explains when storage is unavailable, and lets the admin try again', async () => {
    vi.mocked(adminApi.audioPreview).mockRejectedValueOnce(new ApiRequestError(503, null));
    renderWithProviders(<AudioPreview trackId="t1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Listen to the file' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'File storage is not configured yet',
    );
    expect(screen.getByRole('button', { name: 'Listen to the file' })).toBeEnabled();
  });
});
