import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { ApiRequestError } from '@/lib/api-client';
import { authApi } from './api';
import { AuthForm } from './AuthForm';

vi.mock('./api', () => ({
  authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn(), googleUrl: 'http://api.test/auth/google' },
}));

const login = vi.mocked(authApi.login);
const register = vi.mocked(authApi.register);

function renderForm(mode: 'login' | 'register', initialEntry = '/form') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/form" element={<AuthForm mode={mode} />} />
          <Route path="/" element={<p>home page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const apiError = (status: number) => new ApiRequestError(status, { statusCode: status, error: 'x', message: 'x' });

describe('AuthForm', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('shows field errors from the shared schema and does not call the API', async () => {
    renderForm('register');
    fill('Email', 'not-an-email');
    fill('Password', 'short');
    submit('Create account');

    await screen.findByText('Password must be at least 8 characters');
    expect(register).not.toHaveBeenCalled();
  });

  it('normalises the email and leaves the optional name out when it is empty', async () => {
    register.mockResolvedValue({} as never);
    renderForm('register');
    fill('Email', '  Gina@Example.COM ');
    fill('Password', 'correct-horse-9');
    submit('Create account');

    await screen.findByText('home page');
    // TanStack Query passes its own context as a second argument, so assert on the payload only.
    expect(register.mock.calls[0]?.[0]).toEqual({ email: 'gina@example.com', password: 'correct-horse-9' });
  });

  it('returns to the home page after a successful sign-in', async () => {
    login.mockResolvedValue({} as never);
    renderForm('login');
    fill('Email', 'a@b.dev');
    fill('Password', 'whatever');
    submit('Sign in');

    await screen.findByText('home page');
  });

  it.each([
    [401, 'Invalid email or password.'],
    [409, 'An account with this email already exists.'],
    [429, 'Too many attempts. Please wait a minute and try again.'],
    [500, 'Something went wrong. Please try again.'],
  ])('explains a %i response', async (status, message) => {
    (status === 409 ? register : login).mockRejectedValue(apiError(status));
    renderForm(status === 409 ? 'register' : 'login');
    fill('Email', 'a@b.dev');
    fill('Password', 'correct-horse-9');
    submit(status === 409 ? 'Create account' : 'Sign in');

    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });

  it('reports a failed Google sign-in passed back in the query string', () => {
    renderForm('login', '/form?error=google_denied');

    expect(screen.getByRole('alert').textContent).toBe('Google sign-in did not complete. Please try again.');
  });

  it('links the Google button to the API', () => {
    renderForm('login');

    expect(screen.getByRole('link', { name: 'Continue with Google' }).getAttribute('href')).toBe('http://api.test/auth/google');
  });
});
