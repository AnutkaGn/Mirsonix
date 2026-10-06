import { cleanup, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { LocationProbe } from '@/test/LocationProbe';
import { renderWithProviders } from '@/test/render';
import { HomePage } from './HomePage';

afterEach(cleanup);

const renderHome = (route = '/') =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/catalog" element={<p>catalog page</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route },
  );

describe('HomePage', () => {
  it('invites a visitor to join or sign in', () => {
    useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null });
    renderHome();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sound healing');
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('takes a member straight to the catalog', () => {
    useAuthStore.setState({ status: 'authenticated', user: null, accessToken: 't' });
    renderHome();

    expect(screen.getByText('catalog page')).toBeInTheDocument();
  });

  it('keeps the query when redirecting, so a cancelled checkout is still announced', () => {
    useAuthStore.setState({ status: 'authenticated', user: null, accessToken: 't' });
    renderHome('/?checkout=cancelled');

    expect(screen.getByTestId('location')).toHaveTextContent('/catalog?checkout=cancelled');
  });

  it('shows neither the invitation nor a redirect while it is still unknown who is visiting, so a member never sees it flash', () => {
    useAuthStore.setState({ status: 'unknown', user: null, accessToken: null });
    renderHome();

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText('catalog page')).not.toBeInTheDocument();
  });
});
