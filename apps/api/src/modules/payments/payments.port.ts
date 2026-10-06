import type { BillingInterval } from '@mirsonix/shared';

/** A verified webhook delivery. `object` is Stripe's `data.object`, parsed by whoever handles that event type. */
export interface PaymentEvent {
  id: string;
  type: string;
  object: unknown;
}

export interface CheckoutSessionRequest {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  /** Copied onto the subscription, for people debugging in the Stripe dashboard. Access never trusts it. */
  metadata: Record<string, string>;
}

/** The payment provider as the app needs it. Stripe is one adapter; tests use an in-memory one. */
export abstract class PaymentsPort {
  abstract isConfigured(): boolean;
  abstract createCustomer(input: { userId: string; email: string }): Promise<string>;
  abstract createProduct(input: { name: string; description: string }): Promise<string>;
  abstract createPrice(input: { productId: string; amountMinor: number; currency: string; interval: BillingInterval }): Promise<string>;
  /** Takes a price off sale. Subscriptions already running on it are not affected. */
  abstract archivePrice(priceId: string): Promise<void>;
  /** Returns the hosted checkout page the browser is sent to. */
  abstract createCheckoutSession(input: CheckoutSessionRequest): Promise<string>;
  /** Returns the hosted page where a customer cancels, switches plan and updates their card. */
  abstract createPortalSession(input: { customerId: string; returnUrl: string }): Promise<string>;
  abstract retrieveSubscription(subscriptionId: string): Promise<unknown>;
  abstract cancelSubscription(subscriptionId: string): Promise<void>;
  abstract findInvoiceIdForPaymentIntent(paymentIntentId: string): Promise<string | null>;
  /** Verifies the signature over the exact raw body. Throws a 400 for anything that does not verify. */
  abstract constructEvent(rawBody: Buffer, signature: string | undefined): PaymentEvent;
}
