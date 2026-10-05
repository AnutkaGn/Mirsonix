import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

/** Same domain and visual language as the public app, with its own shell (sidebar). */
export function AdminLayout() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen grid-cols-[14rem_1fr]">
      <aside className="border-r bg-card p-4">
        <NavLink to="/admin" className="text-lg font-semibold tracking-wide">
          Mirsonix <span className="text-xs text-muted-foreground">{t('admin.badge')}</span>
        </NavLink>
      </aside>
      <main className="p-8">
        <Outlet />
      </main>
    </div>
  );
}
