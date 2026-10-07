import type { TopItem } from '@mirsonix/shared';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatPrice } from '@/lib/format';
import { useRevenueSeries, useStatsSummary, useTopStats } from './hooks';
import { toBars } from './revenue-chart';

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function TopList({ title, items }: { title: string; items: TopItem[] }) {
  const { t } = useTranslation();
  return (
    <section aria-label={title} className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.stats.noData')}</p>
      ) : (
        <ol className="grid gap-2 text-sm">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3">
              <span className="w-4 text-muted-foreground">{index + 1}</span>
              <span className="flex-1 truncate">{item.title}</span>
              <span className="font-medium">{item.count}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function StatsDashboard({ days }: { days: number }) {
  const { t } = useTranslation();
  const summary = useStatsSummary({ days });
  const revenue = useRevenueSeries({ days });
  const top = useTopStats({ days, limit: 5 });

  if (summary.isError || revenue.isError || top.isError) {
    return (
      <ErrorState
        message={t('admin.loadError')}
        onRetry={() => void Promise.all([summary.refetch(), revenue.refetch(), top.refetch()])}
      />
    );
  }
  if (!summary.data || !revenue.data || !top.data) return <Skeleton className="h-96" />;

  const money = (amountMinor: number) =>
    formatPrice({ amountMinor, currency: summary.data.currency });
  const bars = toBars(revenue.data.items);
  const { activeSubscriptions, revenue: totals } = summary.data;

  return (
    <div className="space-y-8">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('admin.stats.active')}
          value={String(activeSubscriptions.total)}
          hint={t('admin.stats.activeSplit', {
            tracks: activeSubscriptions.tracks,
            programs: activeSubscriptions.programs,
          })}
        />
        <StatCard
          label={t('admin.stats.revenue')}
          value={money(totals.netMinor)}
          hint={
            totals.refundedMinor > 0
              ? t('admin.stats.refunded', { amount: money(totals.refundedMinor) })
              : undefined
          }
        />
        <StatCard
          label={t('admin.stats.newSubscriptions')}
          value={String(summary.data.newSubscriptions)}
        />
        <StatCard label={t('admin.stats.listens')} value={String(summary.data.listens)} />
      </dl>

      <section aria-labelledby="revenue-title" className="rounded-lg border bg-card p-4">
        <h2 id="revenue-title" className="mb-4 font-medium">
          {t('admin.stats.revenueByDay')}
        </h2>
        <ol className="flex h-40 items-end gap-0.5" aria-label={t('admin.stats.revenueByDay')}>
          {bars.map((bar) => (
            <li
              key={bar.date}
              className="flex h-full flex-1 items-end"
              title={`${formatDate(bar.date)}: ${money(bar.netMinor)}`}
            >
              <span className="sr-only">{`${formatDate(bar.date)}: ${money(bar.netMinor)}`}</span>
              <span
                aria-hidden
                className="w-full rounded-t bg-primary/70"
                style={{ height: `${bar.heightPercent}%` }}
              />
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList title={t('admin.stats.topTracksSales')} items={top.data.sales.tracks} />
        <TopList title={t('admin.stats.topProgramsSales')} items={top.data.sales.programs} />
        <TopList title={t('admin.stats.topTracksListens')} items={top.data.listens.tracks} />
        <TopList title={t('admin.stats.topProgramsListens')} items={top.data.listens.programs} />
      </div>
    </div>
  );
}
