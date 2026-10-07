import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { buttonVariants } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminListFilters } from '@/features/admin/AdminListFilters';
import { useAdminPrograms } from '@/features/admin/hooks';
import { parseListParams, toListSearchParams } from '@/features/admin/list-params';
import { StatusBadge } from '@/features/admin/StatusControls';
import { formatTotalDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

export function AdminProgramsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useSearchParams();
  const params = parseListParams(search);
  const programs = useAdminPrograms({
    page: params.page,
    limit: PAGE_SIZE,
    q: params.q.trim() || undefined,
    status: params.status,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('admin.nav.programs')}</h1>
        <Link to="/admin/programs/new" className={cn(buttonVariants())}>
          <Plus className="mr-1.5 size-4" aria-hidden />
          {t('admin.programs.new')}
        </Link>
      </div>
      <AdminListFilters
        params={params}
        onChange={(patch) => setSearch(toListSearchParams(params, patch), { replace: true })}
      />

      {programs.isError ? (
        <ErrorState message={t('admin.loadError')} onRetry={() => void programs.refetch()} />
      ) : !programs.data ? (
        <Skeleton className="h-64" aria-hidden />
      ) : programs.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.list.empty')}</p>
      ) : (
        <>
          <ul className="divide-y rounded-lg border bg-card">
            {programs.data.items.map((program) => (
              <li key={program.id}>
                <Link
                  to={`/admin/programs/${program.id}`}
                  className="flex items-center gap-4 p-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <CoverImage url={program.posterUrl} className="size-12 shrink-0 rounded-md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{program.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('catalog.trackCount', { count: program.trackCount })}
                      {program.trackCount > 0
                        ? ` · ${formatTotalDuration(program.totalDurationSec)}`
                        : ''}
                    </span>
                  </span>
                  <StatusBadge status={program.status} />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            page={programs.data.meta.page}
            totalPages={programs.data.meta.totalPages}
            onPageChange={(page) => setSearch(toListSearchParams(params, { page }))}
          />
        </>
      )}
    </div>
  );
}
