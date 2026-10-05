import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { PublicLayout } from '@/layouts/PublicLayout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** Route-level code splitting: a page's code loads when it is first visited. Admin never ships to regular users. */
const lazyRoute =
  <M extends Record<string, ComponentType>>(load: () => Promise<M>, name: keyof M) =>
  async () => ({ Component: (await load())[name] });

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/login', lazy: lazyRoute(() => import('@/pages/LoginPage'), 'LoginPage') },
      { path: '/register', lazy: lazyRoute(() => import('@/pages/RegisterPage'), 'RegisterPage') },
      { path: '/auth/callback', lazy: lazyRoute(() => import('@/pages/GoogleCallbackPage'), 'GoogleCallbackPage') },
      {
        element: <RequireAuth />,
        children: [{ path: '/library', lazy: lazyRoute(() => import('@/pages/LibraryPage'), 'LibraryPage') }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <RequireAuth role="ADMIN" />,
    children: [
      {
        path: '/admin',
        lazy: lazyRoute(() => import('@/layouts/AdminLayout'), 'AdminLayout'),
        children: [{ index: true, lazy: lazyRoute(() => import('@/pages/AdminDashboardPage'), 'AdminDashboardPage') }],
      },
    ],
  },
]);
