import type { BillingInterval, Prices } from '@mirsonix/shared';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatPrice } from '@/lib/format';
import { billingErrorKey } from './errors';
import { useCheckout } from './hooks';

interface PurchaseDialogProps {
  target: { kind: 'TRACK' | 'PROGRAM'; id: string };
  title: string;
  prices: Prices;
}

const OPTIONS = [
  { interval: 'MONTH', field: 'month', per: 'perMonth' },
  { interval: 'YEAR', field: 'year', per: 'perYear' },
] as const satisfies readonly { interval: BillingInterval; field: keyof Prices; per: string }[];

/** "Subscribe": choose monthly or yearly, then go to Stripe to pay. Nothing is granted until Stripe confirms. */
export function PurchaseDialog({ target, title, prices }: PurchaseDialogProps) {
  const { t } = useTranslation();
  const checkout = useCheckout();
  const [open, setOpen] = useState(false);
  const offers = OPTIONS.flatMap((option) => (prices[option.field] ? [{ ...option, price: prices[option.field]! }] : []));

  if (offers.length === 0) {
    return (
      <Button disabled title={t('billing.notOnSale')}>
        {t('billing.notOnSale')}
      </Button>
    );
  }

  const subscribe = (interval: BillingInterval) =>
    checkout.mutate({ interval, ...(target.kind === 'TRACK' ? { trackId: target.id } : { programId: target.id }) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t('billing.subscribe')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{t('billing.choosePlan')}</DialogTitle>
        <DialogDescription>{t('billing.choosePlanHint', { title })}</DialogDescription>
        <div className="mt-5 grid gap-3">
          {offers.map(({ interval, per, price }) => (
            <Button key={interval} variant="outline" className="h-auto justify-between px-4 py-3" disabled={checkout.isPending} onClick={() => subscribe(interval)}>
              <span>{t(`billing.${interval === 'MONTH' ? 'monthly' : 'yearly'}`)}</span>
              <span className="font-semibold">{t(`price.${per}`, { price: formatPrice(price) })}</span>
            </Button>
          ))}
        </div>
        {checkout.isPending && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('billing.redirecting')}
          </p>
        )}
        {checkout.isError && (
          <p role="alert" className="mt-4 text-sm text-red-500">
            {t(`billing.errors.${billingErrorKey(checkout.error)}`)}
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">{t('billing.secureNote')}</p>
      </DialogContent>
    </Dialog>
  );
}
