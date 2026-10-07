import type { Prices, SetPricesInput } from '@mirsonix/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminErrorKey, serverMessage } from './errors';
import { Field } from './Field';
import { parsePriceInput, priceToInput } from './money';

interface PriceEditorProps {
  prices: Prices;
  onSave: (input: SetPricesInput) => Promise<unknown>;
}

/** Dollars in, minor units out. A blank field takes that interval off sale. */
export function PriceEditor({ prices, onSave }: PriceEditorProps) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(priceToInput(prices.month?.amountMinor ?? null));
  const [year, setYear] = useState(priceToInput(prices.year?.amountMinor ?? null));
  const [state, setState] = useState<
    { name: 'idle' | 'saving' | 'saved' } | { name: 'failed'; message: string }
  >({ name: 'idle' });
  const [invalid, setInvalid] = useState<{ month?: true; year?: true }>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const monthly = parsePriceInput(month);
    const yearly = parsePriceInput(year);
    setInvalid({
      ...(!monthly.ok && { month: true as const }),
      ...(!yearly.ok && { year: true as const }),
    });
    if (!monthly.ok || !yearly.ok) return;
    setState({ name: 'saving' });
    try {
      await onSave({ monthlyAmountMinor: monthly.minor, yearlyAmountMinor: yearly.minor });
      setState({ name: 'saved' });
    } catch (error) {
      setState({
        name: 'failed',
        message: serverMessage(error) ?? t(`admin.errors.${adminErrorKey(error)}`),
      });
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-lg border bg-card p-4"
      aria-labelledby="price-editor-title"
    >
      <div>
        <h2 id="price-editor-title" className="font-medium">
          {t('admin.prices.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('admin.prices.hint')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.prices.monthly')} error={invalid.month && 'invalid'}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              placeholder={t('admin.prices.offSale')}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('admin.prices.yearly')} error={invalid.year && 'invalid'}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              placeholder={t('admin.prices.offSale')}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={state.name === 'saving'}>
          {state.name === 'saving' ? t('admin.actions.saving') : t('admin.prices.save')}
        </Button>
        {state.name === 'saved' && (
          <span role="status" className="text-sm text-muted-foreground">
            {t('admin.actions.saved')}
          </span>
        )}
        {state.name === 'failed' && (
          <span role="alert" className="text-sm text-red-500">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
