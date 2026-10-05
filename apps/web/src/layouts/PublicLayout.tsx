import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function PublicLayout() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <NavLink to="/" className="text-lg font-semibold tracking-wide">
            {t('app.name')}
          </NavLink>
          <NavLink to="/library" className="text-sm text-muted-foreground hover:text-foreground">
            {t('nav.library')}
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
