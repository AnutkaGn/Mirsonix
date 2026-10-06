import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/components/ui/button';
import { useLogout } from '@/features/auth/hooks';
import { PlayerHost } from '@/features/player/PlayerHost';
import { usePlayerStore } from '@/features/player/player.store';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn('text-sm transition-colors hover:text-foreground', isActive ? 'font-medium text-foreground' : 'text-muted-foreground');

export function AppLayout() {
  const { t } = useTranslation();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const hasTrack = usePlayerStore((state) => state.index >= 0);
  const logout = useLogout();
  const signedIn = status === 'authenticated' && user !== null;

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        {t('nav.skipToContent')}
      </a>
      <header className="border-b">
        <nav aria-label={t('nav.main')} className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-lg font-semibold tracking-wide">
              {t('app.name')}
            </Link>
            {signedIn && (
              <div className="flex items-center gap-5">
                <NavLink to="/catalog" className={navLink}>
                  {t('nav.catalog')}
                </NavLink>
                <NavLink to="/library" className={navLink}>
                  {t('nav.library')}
                </NavLink>
                {user.role === 'ADMIN' && (
                  <NavLink to="/admin" className={navLink}>
                    {t('nav.admin')}
                  </NavLink>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            {signedIn ? (
              <>
                <span className="hidden text-muted-foreground sm:inline">{user.displayName ?? user.email}</span>
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
                  <Link to="/register" className={buttonVariants({ size: 'sm' })}>
                    {t('nav.signUp')}
                  </Link>
                </>
              )
            )}
          </div>
        </nav>
      </header>
      {/* Room for the pinned player, so it never covers the end of a page. */}
      <main id="main" className={cn('mx-auto max-w-6xl px-6 py-10', signedIn && hasTrack && 'pb-32')}>
        <Outlet />
      </main>
      {signedIn && <PlayerHost />}
    </div>
  );
}
