import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';

export function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={t('common.pagination')} className="flex items-center justify-center gap-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t('common.previousPage')}>
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <span className="text-sm text-muted-foreground">{t('common.pageOf', { page, total: totalPages })}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label={t('common.nextPage')}>
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}
