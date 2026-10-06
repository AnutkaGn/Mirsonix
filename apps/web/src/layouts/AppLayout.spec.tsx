import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/features/auth/api';
import { usePlayerStore } from '@/features/player/player.store';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import { AppLayout } from './AppLayout';

vi.mock('@/features/auth/api', () => ({ authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn(), googleUrl: '' } }));
vi.mock('@/features/player/PlayerHost', () => ({ PlayerHost: () => <div data-testid="player-host" /> }));

const user = (role: 'USER' | 'ADMIN') => ({ id: 'u1', email: 'gina@example.com', role, displayName: 'Gina', locale: 'en' });
const signIn = (role: 'USER' | 'ADMIN') => useAuthStore.setState({ status: 'authenticated', user: user(role), accessToken: 't' });

const renderLayout = () =>
  renderWithProviders(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<p>page content</p>} />
      </Route>
    </Routes>,
  );

beforeEach(() => {
  usePlayerStore.getState().clear();
  vi.mocked(authApi.logout).mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('AppLayout', () => {
  it('offers a visitor to sign in or join, and shows no member navigation or player', () => {
    useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null });
    renderLayout();

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
    expect(screen.queryByRole('link', { name: 'Catalog' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('player-host')).not.toBeInTheDocument();
  });

  it('shows neither set of buttons while it is unknown who is visiting', () => {
    useAuthStore.setState({ status: 'unknown', user: null, accessToken: null });
    renderLayout();

    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('gives a member the catalog, their library, their name, and the player', () => {
    signIn('USER');
    renderLayout();
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));

    expect(nav.getByRole('link', { name: 'Catalog' })).toHaveAttribute('href', '/catalog');
    expect(nav.getByRole('link', { name: 'My Library' })).toHaveAttribute('href', '/library');
    expect(nav.getByText('Gina')).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.getByTestId('player-host')).toBeInTheDocument();
  });

  it('adds the admin area for an administrator only', () => {
    signIn('ADMIN');
    renderLayout();

    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('lets a keyboard user skip the navigation', () => {
    signIn('USER');
    renderLayout();

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('leaves room for the pinned player only when something is loaded', () => {
    signIn('USER');
    renderLayout();
    expect(screen.getByRole('main')).not.toHaveClass('pb-32');

    cleanup();
    usePlayerStore.getState().playQueue([{ id: 't1', slug: 's', title: 'T', durationSec: 60, coverUrl: null }]);
    renderLayout();
    expect(screen.getByRole('main')).toHaveClass('pb-32');
  });

  it('signs out, stopping what was playing', async () => {
    signIn('USER');
    usePlayerStore.getState().playQueue([{ id: 't1', slug: 's', title: 'T', durationSec: 60, coverUrl: null }]);
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(authApi.logout).toHaveBeenCalled());
    await waitFor(() => expect(usePlayerStore.getState().queue).toEqual([]));
  });
});
