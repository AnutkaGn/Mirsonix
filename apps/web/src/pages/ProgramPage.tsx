import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/ErrorState';
import { buttonVariants } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { Skeleton } from '@/components/ui/skeleton';
import { PurchaseDialog } from '@/features/billing/PurchaseDialog';
import { useProgram } from '@/features/catalog/hooks';
import { PriceSummary } from '@/features/catalog/PriceSummary';
import { useOwnership } from '@/features/library/hooks';
import { ApiRequestError } from '@/lib/api-client';
import { formatDuration, formatTotalDuration } from '@/lib/format';

export function ProgramPage() {
  const { t } = useTranslation();
  const { slug = '' } = useParams();
  const query = useProgram(slug);
  const ownership = useOwnership().data;

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) {
    const missing = query.error instanceof ApiRequestError && query.error.status === 404;
    return (
      <div className="space-y-4">
        <ErrorState message={t(missing ? 'catalog.notFound' : 'catalog.loadError')} onRetry={missing ? undefined : () => void query.refetch()} />
        <Link to="/catalog?tab=programs" className="text-sm text-primary underline">
          {t('catalog.back')}
        </Link>
      </div>
    );
  }

  const program = query.data;
  const owned = ownership?.programIds.has(program.id) ?? false;
  return (
    <article className="space-y-8">
      <div className="grid gap-8 md:grid-cols-[minmax(0,24rem)_1fr]">
        <CoverImage url={program.posterUrl} className="aspect-video w-full rounded-2xl" />
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">{program.title}</h1>
            <p className="text-xs text-muted-foreground">
              {t('catalog.trackCount', { count: program.trackCount })} · {formatTotalDuration(program.totalDurationSec)}
            </p>
          </div>
          <p className="whitespace-pre-line text-muted-foreground">{program.description}</p>
          <div className="flex flex-wrap items-center gap-4 border-t pt-5">
            {owned ? (
              <Link to={`/library/programs/${program.id}`} className={buttonVariants()}>
                {t('catalog.openLibrary')}
              </Link>
            ) : (
              <>
                <PriceSummary prices={program.prices} />
                <PurchaseDialog target={{ kind: 'PROGRAM', id: program.id }} title={program.title} prices={program.prices} />
              </>
            )}
          </div>
        </div>
      </div>

      <section aria-labelledby="program-tracks" className="space-y-3">
        <h2 id="program-tracks" className="text-lg font-medium">{t('catalog.included')}</h2>
        <ol className="divide-y rounded-lg border bg-card">
          {program.tracks.map((track, position) => (
            <li key={track.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-6 text-right tabular-nums text-muted-foreground">{position + 1}</span>
                <span className="truncate">{track.title}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">{formatDuration(track.durationSec)}</span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
