let counter = 0;
const unique = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(++counter).toString(36)}`;
const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

/** A Stripe subscription object in the current API shape: the billing period lives on the item. */
export function stripeSubscription(options: {
  id?: string;
  customer: string;
  priceId: string;
  status?: string;
  periodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
}) {
  const periodEnd = options.periodEnd ?? new Date(Date.now() + 30 * DAY_MS);
  return {
    id: options.id ?? unique('sub'),
    object: 'subscription',
    customer: options.customer,
    status: options.status ?? 'active',
    cancel_at_period_end: options.cancelAtPeriodEnd ?? false,
    canceled_at: options.canceledAt ? toSeconds(options.canceledAt) : null,
    items: {
      data: [
        {
          price: { id: options.priceId },
          current_period_start: toSeconds(new Date(periodEnd.getTime() - 30 * DAY_MS)),
          current_period_end: toSeconds(periodEnd),
        },
      ],
    },
  };
}

export function stripeInvoice(options: {
  id?: string;
  customer: string;
  subscriptionId?: string | null;
  status?: string;
  amountPaid?: number;
  paidAt?: Date;
}) {
  return {
    id: options.id ?? unique('in'),
    object: 'invoice',
    customer: options.customer,
    status: options.status ?? 'paid',
    amount_paid: options.amountPaid ?? 999,
    currency: 'usd',
    status_transitions: { paid_at: toSeconds(options.paidAt ?? new Date()) },
    parent: options.subscriptionId ? { subscription_details: { subscription: options.subscriptionId } } : null,
  };
}

export function stripeCharge(options: { id?: string; amountRefunded: number; paymentIntent?: string | null }) {
  return {
    id: options.id ?? unique('ch'),
    object: 'charge',
    amount_refunded: options.amountRefunded,
    payment_intent: options.paymentIntent ?? null,
  };
}

/** The envelope Stripe delivers. */
export const stripeEvent = (type: string, object: { id: string }, id: string = unique('evt')) => ({
  id,
  object: 'event',
  type,
  data: { object },
});
