import { healthResponseSchema } from '@mirsonix/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function HomePage() {
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiRequest('/health', { schema: healthResponseSchema, signal }),
  });

  const status = health.isPending ? 'checking' : health.isError ? 'apiOffline' : 'apiOnline';

  return (
    <section className="space-y-4">
      <h1 className="text-4xl font-semibold">{t('app.tagline')}</h1>
      <p
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm',
          health.isError ? 'text-red-500' : 'text-muted-foreground',
        )}
      >
        <span
          className={cn(
            'size-2 rounded-full',
            health.isSuccess ? 'bg-green-500' : health.isError ? 'bg-red-500' : 'bg-yellow-500',
          )}
        />
        {t(`status.${status}`)}
      </p>
    </section>
  );
}
