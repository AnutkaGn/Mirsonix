import type { UserRole } from '@mirsonix/shared';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

/** Route guard. UI convenience only: the API enforces access independently. */
export function RequireAuth({ role }: { role?: UserRole }) {
  const { t } = useTranslation();
  const status = useAuthStore((s) => s.status);
  const userRole = useAuthStore((s) => s.user?.role);
  const location = useLocation();

  if (status === 'unknown') return <p className="p-8 text-muted-foreground">{t('common.loading')}</p>;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && userRole !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
