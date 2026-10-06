import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

/** A fresh client per test, with retries off so a failing request fails the test instead of waiting. */
export const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });

export function renderWithProviders(ui: ReactElement, options: { route?: string; client?: QueryClient } = {}) {
  const client = options.client ?? createTestQueryClient();
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}
