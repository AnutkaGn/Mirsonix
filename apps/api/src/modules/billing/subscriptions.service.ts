import { Injectable, Logger } from '@nestjs/common';
import { isUniqueViolation } from '../../common/db-errors';
import { PricingService } from '../pricing/pricing.service';
import { PaymentsPort } from '../payments/payments.port';
import { UsersService } from '../users/users.service';
import { InvoicesRepository } from './invoices.repository';
import { SubscriptionsRepository } from './subscriptions.repository';
import {
  stripeSubscriptionSchema,
  toInvoiceStatus,
  toSubscriptionStatus,
  type StripeInvoice,
  type StripeSubscription,
} from './stripe-objects';

/** Why an event was set aside instead of applied. Ignoring is deliberate: the Stripe account may hold other products. */
export type SyncOutcome = { applied: true } | { applied: false; reason: string };

/**
 * Keeps our tables equal to Stripe's. Stripe is the source of truth: every method here is an idempotent upsert, so
 * a webhook that is delivered twice, late, or out of order leaves the same result.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly subscriptions: SubscriptionsRepository,
    private readonly invoices: InvoicesRepository,
    private readonly users: UsersService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsPort,
  ) {}

  async syncSubscription(stripe: StripeSubscription): Promise<SyncOutcome> {
    const user = await this.users.findByStripeCustomerId(stripe.customerId);
    if (!user) return { applied: false, reason: 'unknown customer' };
    // The target comes from our own price table, never from metadata a client could have influenced.
    const price = await this.pricing.findByStripePriceId(stripe.priceId);
    if (!price) return { applied: false, reason: 'unknown price' };

    try {
      await this.subscriptions.upsertFromStripe({
        userId: user.id,
        trackId: price.trackId,
        programId: price.programId,
        priceId: price.id,
        stripeSubscriptionId: stripe.id,
        status: toSubscriptionStatus(stripe.status),
        currentPeriodStart: stripe.currentPeriodStart,
        currentPeriodEnd: stripe.currentPeriodEnd,
        cancelAtPeriodEnd: stripe.cancelAtPeriodEnd,
        canceledAt: stripe.canceledAt,
      });
      return { applied: true };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      await this.cancelDuplicate(stripe.id);
      return { applied: false, reason: 'duplicate subscription' };
    }
  }

  async syncInvoice(stripe: StripeInvoice): Promise<SyncOutcome> {
    const user = await this.users.findByStripeCustomerId(stripe.customerId);
    if (!user) return { applied: false, reason: 'unknown customer' };

    await this.invoices.upsertFromStripe({
      userId: user.id,
      subscriptionId: stripe.subscriptionId ? await this.subscriptionRowId(stripe.subscriptionId) : null,
      stripeInvoiceId: stripe.id,
      status: toInvoiceStatus(stripe.status),
      amountPaidMinor: stripe.amountPaidMinor,
      currency: stripe.currency,
      paidAt: stripe.paidAt,
    });
    return { applied: true };
  }

  /** Returns false when the invoice has not been recorded yet, so the caller can ask Stripe to deliver again later. */
  recordRefund(stripeInvoiceId: string, amountRefundedMinor: number): Promise<boolean> {
    return this.invoices.setRefunded(stripeInvoiceId, amountRefundedMinor);
  }

  findInvoiceIdForPaymentIntent(paymentIntentId: string): Promise<string | null> {
    return this.payments.findInvoiceIdForPaymentIntent(paymentIntentId);
  }

  /**
   * Stripe does not promise that the subscription event arrives before its invoice. When it has not, fetch it, so an
   * invoice is never recorded without the subscription it paid for.
   */
  private async subscriptionRowId(stripeSubscriptionId: string): Promise<string | null> {
    let row = await this.subscriptions.findByStripeId(stripeSubscriptionId);
    if (!row) {
      await this.syncSubscription(stripeSubscriptionSchema.parse(await this.payments.retrieveSubscription(stripeSubscriptionId)));
      row = await this.subscriptions.findByStripeId(stripeSubscriptionId);
    }
    return row?.id ?? null;
  }

  /**
   * The user already has a live subscription to this item (they paid twice through two checkouts). Cancel the new
   * one in Stripe so they are not billed for it again. Refunding the first charge is a manual step.
   */
  private async cancelDuplicate(stripeSubscriptionId: string): Promise<void> {
    this.logger.warn(`Duplicate live subscription ${stripeSubscriptionId}: cancelling it in Stripe; a refund may be due`);
    await this.payments.cancelSubscription(stripeSubscriptionId);
  }
}
