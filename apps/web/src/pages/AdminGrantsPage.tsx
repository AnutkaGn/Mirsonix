import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { adminErrorKey, serverMessage } from '@/features/admin/errors';
import { GrantForm } from '@/features/admin/GrantForm';
import { grantState } from '@/features/admin/grants';
import { useAccessGrants, useCreateGrant, useRevokeGrant } from '@/features/admin/hooks';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 20;

export function AdminGrantsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const grants = useAccessGrants({ page, limit: PAGE_SIZE });
  const create = useCreateGrant();
  const revoke = useRevokeGrant();
  const failure = [create, revoke].find((mutation) => mutation.isError)?.error;
  const now = new Date();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t('admin.nav.grants')}</h1>
      <GrantForm
        busy={create.isPending}
        onSubmit={(input) => create.mutate(input, { onSuccess: () => setPage(1) })}
      />
      {failure !== undefined && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
          {serverMessage(failure) ?? t(`admin.errors.${adminErrorKey(failure)}`)}
        </p>
      )}

      {grants.isError ? (
        <ErrorState message={t('admin.loadError')} onRetry={() => void grants.refetch()} />
      ) : !grants.data ? (
        <Skeleton className="h-48" />
      ) : grants.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.grants.empty')}</p>
      ) : (
        <>
          <ul className="divide-y rounded-lg border bg-card">
            {grants.data.items.map((grant) => {
              const state = grantState(grant, now);
              return (
                <li key={grant.id} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{grant.userEmail}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t(grant.trackId ? 'admin.grants.track' : 'admin.grants.program')} ·{' '}
                      {t(`admin.grants.sources.${grant.source}`)}
                      {grant.expiresAt
                        ? ` · ${t('admin.grants.until', { date: formatDate(grant.expiresAt) })}`
                        : ''}
                      {grant.note ? ` · ${grant.note}` : ''}
                    </span>
                  </span>
                  <Badge variant={state === 'active' ? 'default' : 'muted'}>
                    {t(`admin.grants.state.${state}`)}
                  </Badge>
                  {state === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(grant.id)}
                      aria-label={t('admin.grants.revokeFor', { email: grant.userEmail })}
                    >
                      {t('admin.grants.revoke')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination
            page={grants.data.meta.page}
            totalPages={grants.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
