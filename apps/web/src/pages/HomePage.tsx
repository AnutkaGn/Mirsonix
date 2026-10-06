import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/auth.store';

/** The catalog is for members only, so visitors get an invitation and members go straight to it. */
export function HomePage() {
  const { t } = useTranslation();
  const status = useAuthStore((state) => state.status);
  const { search } = useLocation();

  if (status === 'authenticated') return <Navigate to={`/catalog${search}`} replace />; // keeps ?checkout=cancelled
  if (status === 'unknown') return <Skeleton className="h-64" />;

  return (
    <section className="mx-auto max-w-2xl space-y-8 py-16 text-center">
      <h1 className="text-4xl font-semibold sm:text-5xl">{t('app.tagline')}</h1>
      <p className="text-lg text-muted-foreground">{t('home.subtitle')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/register" className={buttonVariants()}>
          {t('home.start')}
        </Link>
        <Link to="/login" className={buttonVariants({ variant: 'outline' })}>
          {t('nav.signIn')}
        </Link>
      </div>
    </section>
  );
}
