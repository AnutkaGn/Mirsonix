import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/components/ui/button';
import { useLogout } from '@/features/auth/hooks';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

export function PublicLayout() {
  const { t } = useTranslation();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <NavLink to="/" className="text-lg font-semibold tracking-wide">
            {t('app.name')}
          </NavLink>
          <div className="flex items-center gap-4 text-sm">
            {status === 'authenticated' && user ? (
              <>
                <NavLink to="/library" className="text-muted-foreground hover:text-foreground">
                  {t('nav.library')}
                </NavLink>
                {user.role === 'ADMIN' && (
                  <NavLink to="/admin" className="text-muted-foreground hover:text-foreground">
                    {t('nav.admin')}
                  </NavLink>
                )}
                <span className="text-muted-foreground">{user.displayName ?? user.email}</span>
                <Button variant="outline" size="sm" onClick={() => logout.mutate()}>
                  {t('nav.signOut')}
                </Button>
              </>
            ) : (
              status === 'anonymous' && (
                <>
                  <Link to="/login" className="text-muted-foreground hover:text-foreground">
                    {t('nav.signIn')}
                  </Link>
                  <Link to="/register" className={cn(buttonVariants({ size: 'sm' }))}>
                    {t('nav.signUp')}
                  </Link>
                </>
              )
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
