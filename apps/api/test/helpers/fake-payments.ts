import { BadRequestException } from '@nestjs/common';
import {
  PaymentsPort,
  type CheckoutSessionRequest,
  type PaymentEvent,
} from '../../src/modules/payments/payments.port';

export const VALID_SIGNATURE = 'valid-signature';

/** In-memory payment provider: records what the app asked Stripe to do, and answers with predictable ids. */
export class FakePayments extends PaymentsPort {
  configured = true;
  failArchive = false;

  customers: { userId: string; email: string }[] = [];
  products: { name: string; description: string }[] = [];
  prices: { productId: string; amountMinor: number; currency: string; interval: string }[] = [];
  archivedPrices: string[] = [];
  checkouts: CheckoutSessionRequest[] = [];
  portals: { customerId: string; returnUrl: string }[] = [];
  canceledSubscriptions: string[] = [];
  /** What `retrieveSubscription` returns, by Stripe subscription id. */
  stripeSubscriptions = new Map<string, unknown>();
  invoiceByPaymentIntent = new Map<string, string>();
  private sequence = 0;

  isConfigured = () => this.configured;

  async createCustomer(input: { userId: string; email: string }): Promise<string> {
    this.customers.push(input);
    return `cus_fake_${++this.sequence}`;
  }

  async createProduct(input: { name: string; description: string }): Promise<string> {
    this.products.push(input);
    return `prod_fake_${++this.sequence}`;
  }

  async createPrice(input: { productId: string; amountMinor: number; currency: string; interval: string }): Promise<string> {
    this.prices.push(input);
    return `price_fake_${++this.sequence}`;
  }

  async archivePrice(priceId: string): Promise<void> {
    if (this.failArchive) throw new Error('Stripe is down');
    this.archivedPrices.push(priceId);
  }

  async createCheckoutSession(input: CheckoutSessionRequest): Promise<string> {
    this.checkouts.push(input);
    return `https://checkout.stripe.test/session/${++this.sequence}`;
  }

  async createPortalSession(input: { customerId: string; returnUrl: string }): Promise<string> {
    this.portals.push(input);
    return `https://portal.stripe.test/session/${++this.sequence}`;
  }

  async retrieveSubscription(subscriptionId: string): Promise<unknown> {
    const found = this.stripeSubscriptions.get(subscriptionId);
    if (!found) throw new Error(`No fake subscription ${subscriptionId}`);
    return found;
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    this.canceledSubscriptions.push(subscriptionId);
  }

  async findInvoiceIdForPaymentIntent(paymentIntentId: string): Promise<string | null> {
    return this.invoiceByPaymentIntent.get(paymentIntentId) ?? null;
  }

  /** Stands in for signature verification: only the agreed header value passes. Real verification has its own tests. */
  constructEvent(rawBody: Buffer, signature: string | undefined): PaymentEvent {
    if (signature !== VALID_SIGNATURE) throw new BadRequestException('Invalid webhook signature');
    const event = JSON.parse(rawBody.toString('utf8')) as { id: string; type: string; data: { object: unknown } };
    return { id: event.id, type: event.type, object: event.data.object };
  }

  reset(): void {
    this.configured = true;
    this.failArchive = false;
    this.customers = [];
    this.products = [];
    this.prices = [];
    this.archivedPrices = [];
    this.checkouts = [];
    this.portals = [];
    this.canceledSubscriptions = [];
    this.stripeSubscriptions.clear();
    this.invoiceByPaymentIntent.clear();
  }
}
