import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeEvent } from './entities/stripe-event.entity';

@Injectable()
export class StripeEventsRepository {
  constructor(@InjectRepository(StripeEvent) private readonly events: Repository<StripeEvent>) {}

  /**
   * Records a delivery and says whether it was already handled. The Stripe event id is the primary key, so the
   * insert is the idempotency check. Only a bare reference to the object is kept, never its (personal) content.
   */
  async record(event: { id: string; type: string; objectId: string | null }): Promise<{ alreadyProcessed: boolean }> {
    await this.events.query(
      `INSERT INTO stripe_events (id, type, payload) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING`,
      [event.id, event.type, JSON.stringify({ objectId: event.objectId })],
    );
    const stored = await this.events.findOneByOrFail({ id: event.id });
    return { alreadyProcessed: stored.status === 'PROCESSED' };
  }

  async markProcessed(id: string): Promise<void> {
    await this.events.update(id, { status: 'PROCESSED', processedAt: new Date(), error: null });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.events.update(id, { status: 'FAILED', error: error.slice(0, 1000) });
  }
}
