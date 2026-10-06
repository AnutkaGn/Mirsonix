import { Injectable } from '@nestjs/common';
import type { PaymentEvent } from '../../payments/payments.port';
import type { StripeEventHandler } from '../stripe-event-handler';
import { stripeInvoiceSchema } from '../stripe-objects';
import { SubscriptionsService } from '../subscriptions.service';

/** Invoices are the record revenue statistics are built from. */
@Injectable()
export class InvoiceEventHandler implements StripeEventHandler {
  readonly types = ['invoice.paid', 'invoice.payment_failed', 'invoice.voided', 'invoice.marked_uncollectible'] as const;

  constructor(private readonly subscriptions: SubscriptionsService) {}

  async handle(event: PaymentEvent): Promise<void> {
    await this.subscriptions.syncInvoice(stripeInvoiceSchema.parse(event.object));
  }
}
