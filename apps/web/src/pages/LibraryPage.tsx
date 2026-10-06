import type { Library } from '@mirsonix/shared';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/ErrorState';
import { Button, buttonVariants } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { Skeleton } from '@/components/ui/skeleton';
import { billingErrorKey } from '@/features/billing/errors';
import { usePortal } from '@/features/billing/hooks';
import { TrackMeta } from '@/features/catalog/TrackMeta';
import { AccessNote } from '@/features/library/AccessNote';
import { useLibrary, useOwnership } from '@/features/library/hooks';
import { useCheckoutReturn } from '@/features/library/useCheckoutReturn';
import { PlayButton } from '@/features/player/PlayButton';
import { toPlayerTrack } from '@/features/player/player-track';
import { formatTotalDuration } from '@/lib/format';

export function LibraryPage() {
  const { t } = useTranslation();
  const ownership = useOwnership();
  const checkout = useCheckoutReturn(ownership.data);
  const library = useLibrary({ pollMs: checkout.pollMs });
  const portal = usePortal();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">{t('library.title')}</h1>
        {ownership.data?.hasSubscription && (
          <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
            {portal.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {t('billing.manage')}
          </Button>
        )}
      </div>

      {portal.isError && <ErrorState message={t(`billing.errors.${billingErrorKey(portal.error)}`)} />}

      {checkout.state !== 'idle' && (
        <div role="status" className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            {checkout.state === 'done' && <CheckCircle2 className="size-4 text-primary" aria-hidden />}
            {checkout.state === 'pending' && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t(`library.checkout.${checkout.state}`)}
          </span>
          <Button variant="ghost" size="sm" onClick={checkout.dismiss}>
            {t('library.checkout.dismiss')}
          </Button>
        </div>
      )}

      {library.isPending && <Skeleton className="h-64" />}
      {library.isError && <ErrorState message={t('library.loadError')} onRetry={() => void library.refetch()} />}
      {library.data && <LibraryLists library={library.data} />}
    </div>
  );
}

function LibraryLists({ library }: { library: Library }) {
  const { t } = useTranslation();
  if (library.tracks.length === 0 && library.programs.length === 0) {
    return (
      <div className="space-y-4 py-12 text-center">
        <h2 className="text-xl font-medium">{t('library.empty')}</h2>
        <p className="text-muted-foreground">{t('library.emptyHint')}</p>
        <Link to="/catalog" className={buttonVariants()}>
          {t('library.browse')}
        </Link>
      </div>
    );
  }

  // Playing one track queues them all, so "next" carries on through the library.
  const queue = library.tracks.map((track) => toPlayerTrack(track));
  return (
    <>
      {library.programs.length > 0 && (
        <section aria-labelledby="library-programs" className="space-y-4">
          <h2 id="library-programs" className="text-xl font-medium">{t('library.programs')}</h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {library.programs.map((program) => (
              <li key={program.id} className="flex flex-col overflow-hidden rounded-lg border bg-card">
                <CoverImage url={program.posterUrl} className="aspect-video w-full" />
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="font-medium">{program.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('catalog.trackCount', { count: program.trackCount })} · {formatTotalDuration(program.totalDurationSec)}
                  </p>
                  <AccessNote access={program.access} />
                  <Link to={`/library/programs/${program.id}`} className={`${buttonVariants({ variant: 'outline', size: 'sm' })} mt-auto self-start`}>
                    {t('library.openProgram')}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {library.tracks.length > 0 && (
        <section aria-labelledby="library-tracks" className="space-y-4">
          <h2 id="library-tracks" className="text-xl font-medium">{t('library.tracks')}</h2>
          <ul className="divide-y rounded-lg border bg-card">
            {library.tracks.map((track, index) => (
              <li key={track.id} className="flex items-center gap-4 p-3">
                <CoverImage url={track.coverUrl} className="size-14 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Link to={`/catalog/tracks/${track.slug}`} className="block truncate font-medium hover:underline">
                    {track.title}
                  </Link>
                  <TrackMeta track={track} />
                  <AccessNote access={track.access} />
                </div>
                <PlayButton tracks={queue} index={index} variant="outline" size="sm" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
