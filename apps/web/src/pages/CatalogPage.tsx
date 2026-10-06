import type { TrackSummary } from '@mirsonix/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CatalogFilters } from '@/features/catalog/CatalogFilters';
import { CATALOG_PAGE_SIZE, hasActiveFilters, parseTab, parseTrackFilters, toSearchParams, type CatalogTab, type TrackFilters } from '@/features/catalog/filters';
import { usePrograms, useTracks } from '@/features/catalog/hooks';
import { ProgramCard } from '@/features/catalog/ProgramCard';
import { TrackCard } from '@/features/catalog/TrackCard';
import { useOwnership } from '@/features/library/hooks';

const GRID = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

function GridSkeleton() {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-72" />
      ))}
    </div>
  );
}

export function CatalogPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get('tab'));
  const filters = useMemo(() => parseTrackFilters(params), [params]);
  const ownership = useOwnership().data;

  const navigate = (nextTab: CatalogTab, next: Partial<TrackFilters>, options: { replace?: boolean } = {}) =>
    setParams(toSearchParams(nextTab, next), options);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold">{t('catalog.title')}</h1>

      {params.get('checkout') === 'cancelled' && (
        <div role="status" className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
          <span>{t('catalog.cancelled')}</span>
          <Button variant="ghost" size="sm" onClick={() => navigate(tab, filters, { replace: true })}>
            {t('catalog.dismiss')}
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => navigate(parseTab(value), { page: 1 })}>
        <TabsList>
          <TabsTrigger value="tracks">{t('catalog.tabs.tracks')}</TabsTrigger>
          <TabsTrigger value="programs">{t('catalog.tabs.programs')}</TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="mt-6 space-y-6">
          <CatalogFilters filters={filters} onChange={(patch) => navigate('tracks', { ...filters, ...patch }, { replace: true })} onClear={() => navigate('tracks', { page: 1 })} />
          <TracksPanel filters={filters} ownedIds={ownership?.trackIds} onPage={(page) => navigate('tracks', { ...filters, page })} />
        </TabsContent>

        <TabsContent value="programs" className="mt-6 space-y-6">
          <ProgramsPanel page={filters.page} ownedIds={ownership?.programIds} onPage={(page) => navigate('programs', { page })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TracksPanel({ filters, ownedIds, onPage }: { filters: TrackFilters; ownedIds?: ReadonlySet<string>; onPage: (page: number) => void }) {
  const { t } = useTranslation();
  const query = useTracks({ ...filters, limit: CATALOG_PAGE_SIZE });

  if (query.isPending) return <GridSkeleton />;
  if (query.isError) return <ErrorState message={t('catalog.loadError')} onRetry={() => void query.refetch()} />;
  const { items, meta } = query.data;
  if (items.length === 0) return <p className="py-12 text-center text-muted-foreground">{t(hasActiveFilters(filters) ? 'catalog.empty' : 'catalog.emptyAll')}</p>;
  return (
    <>
      <div className={GRID}>
        {items.map((track: TrackSummary) => (
          <TrackCard key={track.id} track={track} owned={ownedIds?.has(track.id) ?? false} />
        ))}
      </div>
      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={onPage} />
    </>
  );
}

function ProgramsPanel({ page, ownedIds, onPage }: { page: number; ownedIds?: ReadonlySet<string>; onPage: (page: number) => void }) {
  const { t } = useTranslation();
  const query = usePrograms({ page, limit: CATALOG_PAGE_SIZE });

  if (query.isPending) return <GridSkeleton />;
  if (query.isError) return <ErrorState message={t('catalog.loadError')} onRetry={() => void query.refetch()} />;
  const { items, meta } = query.data;
  if (items.length === 0) return <p className="py-12 text-center text-muted-foreground">{t('catalog.emptyAll')}</p>;
  return (
    <>
      <div className={GRID}>
        {items.map((program) => (
          <ProgramCard key={program.id} program={program} owned={ownedIds?.has(program.id) ?? false} />
        ))}
      </div>
      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={onPage} />
    </>
  );
}
