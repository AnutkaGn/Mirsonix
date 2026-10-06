import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { PaymentsPort } from '../payments/payments.port';
import { describeError } from './describe-error';
import { STRIPE_EVENT_HANDLERS, type StripeEventHandler } from './stripe-event-handler';
import { StripeEventsRepository } from './stripe-events.repository';

export type WebhookResult = 'processed' | 'duplicate' | 'ignored';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly handlers: ReadonlyMap<string, StripeEventHandler>;

  constructor(
    private readonly payments: PaymentsPort,
    private readonly events: StripeEventsRepository,
    @Inject(STRIPE_EVENT_HANDLERS) handlers: StripeEventHandler[],
  ) {
    this.handlers = new Map(handlers.flatMap((handler) => handler.types.map((type) => [type, handler] as const)));
  }

  /**
   * Verifies, deduplicates and dispatches one Stripe delivery. A failure is rethrown so Stripe retries the event;
   * a delivery that was already processed is acknowledged without doing the work again.
   */
  async process(rawBody: Buffer | undefined, signature: string | undefined): Promise<WebhookResult> {
    if (!rawBody) throw new BadRequestException('Missing request body');
    const event = this.payments.constructEvent(rawBody, signature);

    const { alreadyProcessed } = await this.events.record({
      id: event.id,
      type: event.type,
      objectId: (event.object as { id?: string } | null)?.id ?? null,
    });
    if (alreadyProcessed) return 'duplicate';

    const handler = this.handlers.get(event.type);
    if (!handler) {
      await this.events.markProcessed(event.id);
      return 'ignored';
    }
    try {
      await handler.handle(event);
    } catch (error) {
      const reason = describeError(error);
      this.logger.error(`Handling ${event.type} (${event.id}) failed: ${reason}`);
      await this.events.markFailed(event.id, reason);
      throw error;
    }
    await this.events.markProcessed(event.id);
    return 'processed';
  }
}
