import { ArrowLeft, BarChart3, Disc3, KeyRound, ListMusic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/admin', key: 'dashboard', icon: BarChart3, end: true },
  { to: '/admin/tracks', key: 'tracks', icon: Disc3, end: false },
  { to: '/admin/programs', key: 'programs', icon: ListMusic, end: false },
  { to: '/admin/grants', key: 'grants', icon: KeyRound, end: false },
] as const;

/** Same domain and visual language as the public app, with its own shell (sidebar). */
export function AdminLayout() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen grid-cols-1 grid-rows-[auto_1fr] md:grid-cols-[14rem_1fr] md:grid-rows-1">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {t('nav.skipToContent')}
      </a>
      <aside className="border-b bg-card p-4 md:border-b-0 md:border-r">
        <NavLink to="/admin" end className="mb-4 block text-lg font-semibold tracking-wide">
          Mirsonix <span className="text-xs text-muted-foreground">{t('admin.badge')}</span>
        </NavLink>
        <nav aria-label={t('admin.nav.label')} className="flex gap-1 overflow-x-auto md:flex-col">
          {LINKS.map(({ to, key, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
                  isActive && 'bg-muted font-medium',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {t(`admin.nav.${key}`)}
            </NavLink>
          ))}
          <NavLink
            to="/catalog"
            className="mt-2 flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted md:mt-6"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t('admin.nav.backToSite')}
          </NavLink>
        </nav>
      </aside>
      <main id="admin-content" className="min-w-0 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
