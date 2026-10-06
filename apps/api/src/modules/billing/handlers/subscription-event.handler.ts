import { Injectable } from '@nestjs/common';
import type { PaymentEvent } from '../../payments/payments.port';
import type { StripeEventHandler } from '../stripe-event-handler';
import { stripeSubscriptionSchema } from '../stripe-objects';
import { SubscriptionsService } from '../subscriptions.service';

/** Created, changed (renewal, cancel at period end, payment failure) and ended: Stripe sends the full object each time. */
@Injectable()
export class SubscriptionEventHandler implements StripeEventHandler {
  readonly types = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'] as const;

  constructor(private readonly subscriptions: SubscriptionsService) {}

  async handle(event: PaymentEvent): Promise<void> {
    await this.subscriptions.syncSubscription(stripeSubscriptionSchema.parse(event.object));
  }
}
