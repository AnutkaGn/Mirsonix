import { WaveType, WuXingElement } from '@mirsonix/shared';
import { Search } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hasActiveFilters, type TrackFilters } from './filters';
import { useTaxonomy } from './hooks';

const SEARCH_DEBOUNCE_MS = 300;
const selectClasses = 'h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-ring';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

interface CatalogFiltersProps {
  filters: TrackFilters;
  onChange: (patch: Partial<TrackFilters>) => void;
  onClear: () => void;
}

export function CatalogFilters({ filters, onChange, onClear }: CatalogFiltersProps) {
  const { t } = useTranslation();
  const taxonomy = useTaxonomy();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The box shows what is being typed. It only reaches the address after a pause, so each keystroke is not a request.
  const [draft, setDraft] = useState(filters.q ?? '');
  const [shownQ, setShownQ] = useState(filters.q);
  if (filters.q !== shownQ) {
    // The address changed from outside (back button, "clear"): show it. React allows this one guarded update during render.
    setShownQ(filters.q);
    setDraft(filters.q ?? '');
  }

  const onSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDraft(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ q: value.trim() || undefined, page: 1 }), SEARCH_DEBOUNCE_MS);
  };
  const pick = (key: 'wave' | 'element' | 'issue' | 'meridian') => (event: ChangeEvent<HTMLSelectElement>) =>
    onChange({ [key]: event.target.value || undefined, page: 1 });

  const meridians = taxonomy.data ? [...taxonomy.data.elements.flatMap((element) => element.meridians), ...taxonomy.data.vessels] : [];
  return (
    <form role="search" className="space-y-4" onSubmit={(event) => event.preventDefault()} aria-label={t('catalog.filters.label')}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" value={draft} onChange={onSearch} placeholder={t('catalog.search')} aria-label={t('catalog.search')} className="pl-9" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label={t('catalog.filters.wave')}>
          <select className={selectClasses} value={filters.wave ?? ''} onChange={pick('wave')}>
            <option value="">{t('catalog.filters.any')}</option>
            {WaveType.values.map((wave) => (
              <option key={wave} value={wave}>
                {t(`waves.${wave}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('catalog.filters.element')}>
          <select className={selectClasses} value={filters.element ?? ''} onChange={pick('element')}>
            <option value="">{t('catalog.filters.any')}</option>
            {WuXingElement.values.map((element) => (
              <option key={element} value={element}>
                {taxonomy.data?.elements.find((entry) => entry.code === element)?.name ?? element}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('catalog.filters.meridian')}>
          <select className={selectClasses} value={filters.meridian ?? ''} onChange={pick('meridian')} disabled={!taxonomy.data}>
            <option value="">{t('catalog.filters.any')}</option>
            {meridians.map((meridian) => (
              <option key={meridian.code} value={meridian.code}>
                {meridian.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('catalog.filters.issue')}>
          <select className={selectClasses} value={filters.issue ?? ''} onChange={pick('issue')} disabled={!taxonomy.data}>
            <option value="">{t('catalog.filters.any')}</option>
            {taxonomy.data?.issues.map((issue) => (
              <option key={issue.slug} value={issue.slug}>
                {issue.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {hasActiveFilters(filters) && (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {t('catalog.filters.clear')}
        </Button>
      )}
    </form>
  );
}
