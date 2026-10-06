import type { ProgramSummary } from '@mirsonix/shared';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { CoverImage } from '@/components/ui/cover-image';
import { formatTotalDuration } from '@/lib/format';
import { PriceSummary } from './PriceSummary';

export function ProgramCard({ program, owned }: { program: ProgramSummary; owned: boolean }) {
  const { t } = useTranslation();
  const to = `/catalog/programs/${program.slug}`;
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <Link to={to} className="block focus-visible:outline-2 focus-visible:outline-ring" tabIndex={-1} aria-hidden>
        <CoverImage url={program.posterUrl} className="aspect-video w-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-medium leading-snug">
          <Link to={to} className="hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            {program.title}
          </Link>
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('catalog.trackCount', { count: program.trackCount })} · {formatTotalDuration(program.totalDurationSec)}
        </p>
        <p className="line-clamp-2 text-sm text-muted-foreground">{program.description}</p>
        <div className="mt-auto pt-2">{owned ? <Badge>{t('catalog.owned')}</Badge> : <PriceSummary prices={program.prices} />}</div>
      </div>
    </article>
  );
}
