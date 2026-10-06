import { Injectable } from '@nestjs/common';
import type { PaymentEvent } from '../../payments/payments.port';
import type { StripeEventHandler } from '../stripe-event-handler';
import { stripeChargeSchema } from '../stripe-objects';
import { SubscriptionsService } from '../subscriptions.service';

/** Tracks refunds against the invoice they belong to, so revenue is reported net. */
@Injectable()
export class ChargeEventHandler implements StripeEventHandler {
  readonly types = ['charge.refunded'] as const;

  constructor(private readonly subscriptions: SubscriptionsService) {}

  async handle(event: PaymentEvent): Promise<void> {
    const charge = stripeChargeSchema.parse(event.object);
    const invoiceId =
      charge.invoiceId ?? (charge.paymentIntentId ? await this.subscriptions.findInvoiceIdForPaymentIntent(charge.paymentIntentId) : null);
    if (!invoiceId) return; // a one-off charge outside any invoice: not part of subscription revenue

    // Throwing makes Stripe deliver the event again, by which time the invoice event has normally been processed.
    if (!(await this.subscriptions.recordRefund(invoiceId, charge.amountRefundedMinor))) {
      throw new Error(`Invoice ${invoiceId} is not recorded yet; the refund will be retried`);
    }
  }
}
