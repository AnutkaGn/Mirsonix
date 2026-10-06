import type { TrackSummary } from '@mirsonix/shared';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { CoverImage } from '@/components/ui/cover-image';
import { PlayButton } from '@/features/player/PlayButton';
import { toPlayerTrack } from '@/features/player/player-track';
import { PriceSummary } from './PriceSummary';
import { TrackMeta } from './TrackMeta';

export function TrackCard({ track, owned }: { track: TrackSummary; owned: boolean }) {
  const { t } = useTranslation();
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <Link to={`/catalog/tracks/${track.slug}`} className="block focus-visible:outline-2 focus-visible:outline-ring" tabIndex={-1} aria-hidden>
        <CoverImage url={track.coverUrl} className="aspect-square w-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-medium leading-snug">
          <Link to={`/catalog/tracks/${track.slug}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            {track.title}
          </Link>
        </h3>
        <TrackMeta track={track} />
        {track.issues.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t('catalog.helpsWith')}>
            {track.issues.slice(0, 3).map((issue) => (
              <li key={issue.slug}>
                <Badge variant="muted">{issue.name}</Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          {owned ? (
            <>
              <Badge>{t('catalog.owned')}</Badge>
              <PlayButton tracks={[toPlayerTrack(track)]} variant="outline" size="sm" />
            </>
          ) : (
            <PriceSummary prices={track.prices} />
          )}
        </div>
      </div>
    </article>
  );
}
