import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { SubscriptionStatus } from '@mirsonix/shared';
import { Not, In, Repository } from 'typeorm';
import type { ContentTarget } from '../../common/content-target';
import { Subscription } from './entities/subscription.entity';

export interface SubscriptionUpsert {
  userId: string;
  trackId: string | null;
  programId: string | null;
  priceId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
}

/** Statuses after which a subscription is over for good, so the same item can be subscribed to again. */
const TERMINAL_STATUSES: SubscriptionStatus[] = ['CANCELED', 'INCOMPLETE_EXPIRED'];

@Injectable()
export class SubscriptionsRepository {
  constructor(@InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>) {}

  findByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    return this.subscriptions.findOneBy({ stripeSubscriptionId });
  }

  /** The user's current subscription to this item, if any: the one the partial unique index protects. */
  findLive(userId: string, target: ContentTarget): Promise<Subscription | null> {
    return this.subscriptions.findOneBy({
      userId,
      ...(target.kind === 'TRACK' ? { trackId: target.id } : { programId: target.id }),
      status: Not(In(TERMINAL_STATUSES)),
    });
  }

  /** Atomic insert-or-update keyed by Stripe's id, so two webhooks for one subscription cannot race into duplicates. */
  async upsertFromStripe(data: SubscriptionUpsert): Promise<Subscription> {
    await this.subscriptions.upsert(data, ['stripeSubscriptionId']);
    return this.subscriptions.findOneByOrFail({ stripeSubscriptionId: data.stripeSubscriptionId });
  }
}
