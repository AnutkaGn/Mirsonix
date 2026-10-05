import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { RequireAuth } from './RequireAuth';

const user = (role: 'USER' | 'ADMIN') => ({
  id: '00000000-0000-4000-8000-000000000001',
  email: 'a@b.dev',
  role,
  displayName: null,
  locale: 'en',
});

function renderAt(path: string, role?: 'ADMIN') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireAuth role={role} />}>
          <Route path="/private" element={<p>secret page</p>} />
        </Route>
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => useAuthStore.setState({ status: 'unknown', user: null, accessToken: null }));
  afterEach(cleanup);

  it('shows a loading state until the session check finishes, instead of redirecting', () => {
    renderAt('/private');

    expect(screen.queryByText('Loading…')).not.toBeNull();
    expect(screen.queryByText('login page')).toBeNull();
  });

  it('sends an anonymous visitor to the login page', () => {
    useAuthStore.setState({ status: 'anonymous' });
    renderAt('/private');

    expect(screen.queryByText('login page')).not.toBeNull();
    expect(screen.queryByText('secret page')).toBeNull();
  });

  it('lets any signed-in user through when no role is required', () => {
    useAuthStore.setState({ status: 'authenticated', user: user('USER') });
    renderAt('/private');

    expect(screen.queryByText('secret page')).not.toBeNull();
  });

  it('keeps a regular user out of an admin route', () => {
    useAuthStore.setState({ status: 'authenticated', user: user('USER') });
    renderAt('/private', 'ADMIN');

    expect(screen.queryByText('home page')).not.toBeNull();
    expect(screen.queryByText('secret page')).toBeNull();
  });

  it('lets an admin into an admin route', () => {
    useAuthStore.setState({ status: 'authenticated', user: user('ADMIN') });
    renderAt('/private', 'ADMIN');

    expect(screen.queryByText('secret page')).not.toBeNull();
  });
});
