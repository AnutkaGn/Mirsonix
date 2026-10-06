import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/ErrorState';
import { Badge } from '@/components/ui/badge';
import { CoverImage } from '@/components/ui/cover-image';
import { Skeleton } from '@/components/ui/skeleton';
import { PurchaseDialog } from '@/features/billing/PurchaseDialog';
import { PriceSummary } from '@/features/catalog/PriceSummary';
import { useTrack } from '@/features/catalog/hooks';
import { TrackMeta } from '@/features/catalog/TrackMeta';
import { useOwnership } from '@/features/library/hooks';
import { PlayButton } from '@/features/player/PlayButton';
import { toPlayerTrack } from '@/features/player/player-track';
import { ApiRequestError } from '@/lib/api-client';

export function TrackPage() {
  const { t } = useTranslation();
  const { slug = '' } = useParams();
  const query = useTrack(slug);
  const ownership = useOwnership().data;

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) {
    const missing = query.error instanceof ApiRequestError && query.error.status === 404;
    return (
      <div className="space-y-4">
        <ErrorState message={t(missing ? 'catalog.notFound' : 'catalog.loadError')} onRetry={missing ? undefined : () => void query.refetch()} />
        <Link to="/catalog" className="text-sm text-primary underline">
          {t('catalog.back')}
        </Link>
      </div>
    );
  }

  const track = query.data;
  const owned = ownership?.trackIds.has(track.id) ?? false;
  return (
    <article className="grid gap-8 md:grid-cols-[minmax(0,20rem)_1fr]">
      <CoverImage url={track.coverUrl} className="aspect-square w-full rounded-2xl" />
      <div className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">{track.title}</h1>
          <TrackMeta track={track} />
        </div>
        <p className="whitespace-pre-line text-muted-foreground">{track.description}</p>

        {track.meridians.length > 0 && (
          <section aria-labelledby="meridians-heading" className="space-y-2">
            <h2 id="meridians-heading" className="text-sm font-medium">{t('catalog.meridians')}</h2>
            <ul className="flex flex-wrap gap-1.5">
              {track.meridians.map((meridian) => (
                <li key={meridian.code}>
                  <Badge variant="outline">{meridian.name}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}
        {track.issues.length > 0 && (
          <section aria-labelledby="issues-heading" className="space-y-2">
            <h2 id="issues-heading" className="text-sm font-medium">{t('catalog.targets')}</h2>
            <ul className="flex flex-wrap gap-1.5">
              {track.issues.map((issue) => (
                <li key={issue.slug}>
                  <Badge variant="muted">{issue.name}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t pt-5">
          {owned ? (
            <>
              <PlayButton tracks={[toPlayerTrack(track)]}>{t('player.play')}</PlayButton>
              <Link to="/library" className="text-sm text-primary underline">
                {t('catalog.openLibrary')}
              </Link>
            </>
          ) : (
            <>
              <PriceSummary prices={track.prices} />
              <PurchaseDialog target={{ kind: 'TRACK', id: track.id }} title={track.title} prices={track.prices} />
            </>
          )}
        </div>
      </div>
    </article>
  );
}
