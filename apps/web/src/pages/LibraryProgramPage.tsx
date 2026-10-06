import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/ErrorState';
import { CoverImage } from '@/components/ui/cover-image';
import { Skeleton } from '@/components/ui/skeleton';
import { TrackMeta } from '@/features/catalog/TrackMeta';
import { AccessNote } from '@/features/library/AccessNote';
import { useLibraryProgram } from '@/features/library/hooks';
import { PlayButton } from '@/features/player/PlayButton';
import { toPlayerTrack } from '@/features/player/player-track';
import { ApiRequestError } from '@/lib/api-client';
import { formatTotalDuration } from '@/lib/format';

export function LibraryProgramPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const query = useLibraryProgram(id);

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) {
    const forbidden = query.error instanceof ApiRequestError && query.error.status === 403;
    return (
      <div className="space-y-4">
        <ErrorState message={t(forbidden ? 'library.programNoAccess' : 'library.loadError')} onRetry={forbidden ? undefined : () => void query.refetch()} />
        <Link to="/library" className="text-sm text-primary underline">
          {t('library.title')}
        </Link>
      </div>
    );
  }

  const program = query.data;
  // The program is the playing context, so each listen is counted towards it.
  const queue = program.tracks.map((track) => toPlayerTrack(track, program.id));
  return (
    <article className="space-y-8">
      <div className="grid gap-8 md:grid-cols-[minmax(0,24rem)_1fr]">
        <CoverImage url={program.posterUrl} className="aspect-video w-full rounded-2xl" />
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold">{program.title}</h1>
          <p className="text-xs text-muted-foreground">
            {t('catalog.trackCount', { count: program.trackCount })} · {formatTotalDuration(program.totalDurationSec)}
          </p>
          <AccessNote access={program.access} className="text-sm text-muted-foreground" />
          <p className="whitespace-pre-line text-muted-foreground">{program.description}</p>
          <PlayButton tracks={queue} index={0}>
            {t('library.playAll')}
          </PlayButton>
        </div>
      </div>

      <ol className="divide-y rounded-lg border bg-card">
        {program.tracks.map((track, index) => (
          <li key={track.id} className="flex items-center gap-4 p-3">
            <span className="w-6 text-right tabular-nums text-muted-foreground">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{track.title}</p>
              <TrackMeta track={track} />
            </div>
            <PlayButton tracks={queue} index={index} variant="outline" size="sm" />
          </li>
        ))}
      </ol>
    </article>
  );
}
