import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { BillingInterval } from '@mirsonix/shared';
import Stripe from 'stripe';
import { AppConfig } from '../../config/app-config.module';
import { PaymentsPort, type CheckoutSessionRequest, type PaymentEvent } from './payments.port';

const STRIPE_INTERVAL: Record<BillingInterval, 'month' | 'year'> = { MONTH: 'month', YEAR: 'year' };

@Injectable()
export class StripePaymentsService extends PaymentsPort {
  private client: Stripe | null = null;

  constructor(private readonly config: AppConfig) {
    super();
  }

  isConfigured(): boolean {
    return Boolean(this.config.get('STRIPE_SECRET_KEY'));
  }

  async createCustomer({ userId, email }: { userId: string; email: string }): Promise<string> {
    const customer = await this.stripe().customers.create(
      { email, metadata: { userId } },
      { idempotencyKey: `customer:${userId}` }, // a double click must not create two customers
    );
    return customer.id;
  }

  async createProduct({ name, description }: { name: string; description: string }): Promise<string> {
    const product = await this.stripe().products.create({ name, description: description.slice(0, 500) });
    return product.id;
  }

  async createPrice(input: { productId: string; amountMinor: number; currency: string; interval: BillingInterval }): Promise<string> {
    const price = await this.stripe().prices.create({
      product: input.productId,
      unit_amount: input.amountMinor,
      currency: input.currency,
      recurring: { interval: STRIPE_INTERVAL[input.interval] },
    });
    return price.id;
  }

  async archivePrice(priceId: string): Promise<void> {
    await this.stripe().prices.update(priceId, { active: false });
  }

  async createCheckoutSession(input: CheckoutSessionRequest): Promise<string> {
    const session = await this.stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: input.customerId,
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.userId,
      metadata: input.metadata,
      subscription_data: { metadata: input.metadata },
      allow_promotion_codes: true,
    });
    if (!session.url) throw new ServiceUnavailableException('Stripe did not return a checkout page');
    return session.url;
  }

  async createPortalSession({ customerId, returnUrl }: { customerId: string; returnUrl: string }): Promise<string> {
    const session = await this.stripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    return session.url;
  }

  retrieveSubscription(subscriptionId: string): Promise<unknown> {
    return this.stripe().subscriptions.retrieve(subscriptionId);
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripe().subscriptions.cancel(subscriptionId);
  }

  async findInvoiceIdForPaymentIntent(paymentIntentId: string): Promise<string | null> {
    const payments = await this.stripe().invoicePayments.list({
      payment: { type: 'payment_intent', payment_intent: paymentIntentId },
      limit: 1,
    });
    const invoice = payments.data[0]?.invoice;
    return typeof invoice === 'string' ? invoice : (invoice?.id ?? null);
  }

  constructEvent(rawBody: Buffer, signature: string | undefined): PaymentEvent {
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new ServiceUnavailableException('Webhooks are not configured');
    if (!signature) throw new BadRequestException('Missing Stripe signature');
    try {
      const event = this.stripe().webhooks.constructEvent(rawBody, signature, secret);
      return { id: event.id, type: event.type, object: event.data.object };
    } catch {
      // A forged, tampered, replayed-too-late or mis-secreted request. Say nothing about which.
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  /** Overridable so tests can hand in a fake client without touching the network. */
  protected createClient(apiKey: string): Stripe {
    return new Stripe(apiKey, { maxNetworkRetries: 2, timeout: 20_000 });
  }

  private stripe(): Stripe {
    const apiKey = this.config.get('STRIPE_SECRET_KEY');
    if (!apiKey) throw new ServiceUnavailableException('Payments are not configured');
    this.client ??= this.createClient(apiKey);
    return this.client;
  }
}
