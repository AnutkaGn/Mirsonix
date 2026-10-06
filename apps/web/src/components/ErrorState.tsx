import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/** A failed load, with a way out. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm">
      <p>{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
