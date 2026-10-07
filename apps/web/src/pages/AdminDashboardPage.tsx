import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { StatsDashboard } from '@/features/admin/StatsDashboard';

const PERIODS = [7, 30, 90, 365] as const;

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('admin.nav.dashboard')}</h1>
        <Select
          className="w-44"
          aria-label={t('admin.stats.period')}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {PERIODS.map((period) => (
            <option key={period} value={period}>
              {t('admin.stats.lastDays', { count: period })}
            </option>
          ))}
        </Select>
      </div>
      <StatsDashboard days={days} />
    </div>
  );
}
