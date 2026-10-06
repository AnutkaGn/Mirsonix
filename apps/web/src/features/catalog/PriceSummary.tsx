import type { Prices } from '@mirsonix/shared';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '@/lib/format';

/** What an item costs, in the intervals it is sold for. An item nobody can buy yet says so, rather than showing nothing. */
export function PriceSummary({ prices }: { prices: Prices }) {
  const { t } = useTranslation();
  if (!prices.month && !prices.year) return <span className="text-sm text-muted-foreground">{t('billing.notOnSale')}</span>;
  return (
    <span className="flex flex-wrap gap-x-3 text-sm">
      {prices.month && <span className="font-medium">{t('price.perMonth', { price: formatPrice(prices.month) })}</span>}
      {prices.year && <span className="text-muted-foreground">{t('price.perYear', { price: formatPrice(prices.year) })}</span>}
    </span>
  );
}
