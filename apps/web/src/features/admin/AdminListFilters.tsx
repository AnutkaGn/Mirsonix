import { ContentStatus } from '@mirsonix/shared';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ListParams } from './list-params';

export function AdminListFilters({
  params,
  onChange,
}: {
  params: ListParams;
  onChange: (patch: Partial<ListParams>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-3">
      <Input
        type="search"
        className="max-w-xs"
        aria-label={t('admin.list.search')}
        placeholder={t('admin.list.search')}
        value={params.q}
        onChange={(e) => onChange({ q: e.target.value })}
      />
      <Select
        className="w-44"
        aria-label={t('admin.list.status')}
        value={params.status ?? ''}
        onChange={(e) => onChange({ status: ContentStatus.schema.safeParse(e.target.value).data })}
      >
        <option value="">{t('admin.list.anyStatus')}</option>
        {ContentStatus.values.map((status) => (
          <option key={status} value={status}>
            {t(`admin.status.${status}`)}
          </option>
        ))}
      </Select>
    </div>
  );
}
