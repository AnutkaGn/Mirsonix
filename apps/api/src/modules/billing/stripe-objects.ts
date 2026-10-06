import type { SubscriptionStatus } from '@mirsonix/shared';
import { z } from 'zod';

/**
 * The few fields of Stripe's objects this app reads, parsed from the webhook payload. Parsing here means a changed
 * or unexpected payload fails loudly in one place instead of leaking `undefined` into the database.
 * Stripe moved the billing period from the subscription onto its items and the subscription link off the invoice,
 * so both old and new locations are accepted.
 */

/** A reference is either an id or an expanded object, depending on how the event was built. */
const reference = z.union([z.string(), z.object({ id: z.string() }).transform((object) => object.id)]);
const seconds = z.number().transform((value) => new Date(value * 1000));

const subscriptionItem = z.object({
  price: z.object({ id: z.string() }),
  current_period_start: seconds.optional(),
  current_period_end: seconds.optional(),
});

export const stripeSubscriptionSchema = z
  .object({
    id: z.string(),
    customer: reference,
    status: z.string(),
    cancel_at_period_end: z.boolean(),
    canceled_at: seconds.nullish(),
    current_period_start: seconds.optional(),
    current_period_end: seconds.optional(),
    items: z.object({ data: z.array(subscriptionItem).min(1) }),
  })
  .transform((subscription) => {
    const item = subscription.items.data[0]!;
    return {
      id: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ?? null,
      priceId: item.price.id,
      currentPeriodStart: item.current_period_start ?? subscription.current_period_start ?? null,
      currentPeriodEnd: item.current_period_end ?? subscription.current_period_end ?? null,
    };
  });
export type StripeSubscription = z.infer<typeof stripeSubscriptionSchema>;

export const stripeInvoiceSchema = z
  .object({
    id: z.string(),
    customer: reference,
    status: z.string().nullable(),
    amount_paid: z.number().int(),
    currency: z.string(),
    status_transitions: z.object({ paid_at: seconds.nullish() }).optional(),
    subscription: reference.nullish(),
    parent: z
      .object({ subscription_details: z.object({ subscription: reference }).nullish() })
      .nullish(),
  })
  .transform((invoice) => ({
    id: invoice.id,
    customerId: invoice.customer,
    subscriptionId: invoice.parent?.subscription_details?.subscription ?? invoice.subscription ?? null,
    status: invoice.status,
    amountPaidMinor: invoice.amount_paid,
    currency: invoice.currency,
    paidAt: invoice.status_transitions?.paid_at ?? null,
  }));
export type StripeInvoice = z.infer<typeof stripeInvoiceSchema>;

export const stripeChargeSchema = z
  .object({
    id: z.string(),
    amount_refunded: z.number().int(),
    payment_intent: reference.nullish(),
    invoice: reference.nullish(),
  })
  .transform((charge) => ({
    id: charge.id,
    amountRefundedMinor: charge.amount_refunded,
    paymentIntentId: charge.payment_intent ?? null,
    invoiceId: charge.invoice ?? null,
  }));

const SUBSCRIPTION_STATUS: Record<string, SubscriptionStatus> = {
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'INCOMPLETE_EXPIRED',
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'UNPAID',
  paused: 'PAUSED',
};

/** A status this app does not know is treated as no access, never as access. */
export const toSubscriptionStatus = (stripeStatus: string): SubscriptionStatus => SUBSCRIPTION_STATUS[stripeStatus] ?? 'UNPAID';

const INVOICE_STATUS = { draft: 'DRAFT', open: 'OPEN', paid: 'PAID', uncollectible: 'UNCOLLECTIBLE', void: 'VOID' } as const;

export const toInvoiceStatus = (stripeStatus: string | null): (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS] =>
  INVOICE_STATUS[stripeStatus as keyof typeof INVOICE_STATUS] ?? 'OPEN';
