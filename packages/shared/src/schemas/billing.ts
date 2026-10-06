import { z } from 'zod';
import { MAX_PRICE_MINOR, MIN_PRICE_MINOR } from '../constants';
import { BillingInterval } from '../enums';

export const priceSchema = z.object({
  amountMinor: z.number().int(),
  currency: z.string(),
});
export type Price = z.infer<typeof priceSchema>;

/** What an item costs, per billing interval. A null side means that interval is not on sale. */
export const pricesSchema = z.object({ month: priceSchema.nullable(), year: priceSchema.nullable() });
export type Prices = z.infer<typeof pricesSchema>;

const amountMinor = z.number().int().min(MIN_PRICE_MINOR).max(MAX_PRICE_MINOR);

/** Both fields are required, so a request always states what happens to each interval; null takes it off sale. */
export const setPricesSchema = z.object({
  monthlyAmountMinor: amountMinor.nullable(),
  yearlyAmountMinor: amountMinor.nullable(),
});
export type SetPricesInput = z.infer<typeof setPricesSchema>;

export const hasExactlyOneTarget = (value: { trackId?: string | null; programId?: string | null }): boolean =>
  Boolean(value.trackId) !== Boolean(value.programId);

export const checkoutRequestSchema = z
  .object({
    trackId: z.uuid().optional(),
    programId: z.uuid().optional(),
    interval: BillingInterval.schema,
  })
  .refine(hasExactlyOneTarget, { message: 'Provide exactly one of trackId or programId', path: ['trackId'] });
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const redirectUrlSchema = z.object({ url: z.string().min(1) });
export type RedirectUrl = z.infer<typeof redirectUrlSchema>;
