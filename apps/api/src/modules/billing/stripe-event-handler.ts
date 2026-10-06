import type { PaymentEvent } from '../payments/payments.port';

/** One handler per family of Stripe events. The webhook service picks the handler by event type. */
export interface StripeEventHandler {
  readonly types: readonly string[];
  handle(event: PaymentEvent): Promise<void>;
}

export const STRIPE_EVENT_HANDLERS = Symbol('STRIPE_EVENT_HANDLERS');
