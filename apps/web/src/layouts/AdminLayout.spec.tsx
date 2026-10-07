import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AdminLayout } from './AdminLayout';

afterEach(cleanup);

const renderAt = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>dashboard page</p>} />
          <Route path="tracks" element={<p>tracks page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('AdminLayout', () => {
  it('links to every admin area and back to the site', () => {
    renderAt('/admin');

    const nav = screen.getByRole('navigation', { name: 'Admin' });
    const hrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'));

    expect(hrefs).toEqual([
      '/admin',
      '/admin/tracks',
      '/admin/programs',
      '/admin/grants',
      '/catalog',
    ]);
  });

  it('renders the page inside the main region', () => {
    renderAt('/admin/tracks');

    expect(screen.getByRole('main')).toHaveTextContent('tracks page');
  });

  it('marks only the current area, not the dashboard on every page', () => {
    renderAt('/admin/tracks');

    expect(screen.getByRole('link', { name: 'Tracks' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('has a way to skip the menu', () => {
    renderAt('/admin');

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#admin-content',
    );
  });
});
