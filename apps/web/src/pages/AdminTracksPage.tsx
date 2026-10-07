import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { buttonVariants } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminListFilters } from '@/features/admin/AdminListFilters';
import { useAdminTracks } from '@/features/admin/hooks';
import { parseListParams, toListSearchParams } from '@/features/admin/list-params';
import { StatusBadge } from '@/features/admin/StatusControls';
import { formatDuration, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

export function AdminTracksPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useSearchParams();
  const params = parseListParams(search);
  const tracks = useAdminTracks({
    page: params.page,
    limit: PAGE_SIZE,
    q: params.q.trim() || undefined,
    status: params.status,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('admin.nav.tracks')}</h1>
        <Link to="/admin/tracks/new" className={cn(buttonVariants())}>
          <Plus className="mr-1.5 size-4" aria-hidden />
          {t('admin.tracks.new')}
        </Link>
      </div>
      <AdminListFilters
        params={params}
        onChange={(patch) => setSearch(toListSearchParams(params, patch), { replace: true })}
      />

      {tracks.isError ? (
        <ErrorState message={t('admin.loadError')} onRetry={() => void tracks.refetch()} />
      ) : !tracks.data ? (
        <Skeleton className="h-64" aria-hidden />
      ) : tracks.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.list.empty')}</p>
      ) : (
        <>
          <ul className="divide-y rounded-lg border bg-card">
            {tracks.data.items.map((track) => (
              <li key={track.id}>
                <Link
                  to={`/admin/tracks/${track.id}`}
                  className="flex items-center gap-4 p-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <CoverImage url={track.coverUrl} className="size-12 shrink-0 rounded-md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{track.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDuration(track.durationSec)}
                      {track.prices.month
                        ? ` · ${t('price.perMonth', { price: formatPrice(track.prices.month) })}`
                        : ` · ${t('billing.notOnSale')}`}
                    </span>
                  </span>
                  <StatusBadge status={track.status} />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            page={tracks.data.meta.page}
            totalPages={tracks.data.meta.totalPages}
            onPageChange={(page) => setSearch(toListSearchParams(params, { page }))}
          />
        </>
      )}
    </div>
  );
}
