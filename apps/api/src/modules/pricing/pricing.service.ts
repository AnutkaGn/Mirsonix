import { Injectable } from '@nestjs/common';
import type { BillingInterval, Prices } from '@mirsonix/shared';
import { targetKey, type ContentTarget } from '../../common/content-target';
import type { Price } from '../billing/entities/price.entity';
import { NO_PRICES, PriceBook } from './price-book';
import { PricesRepository, type NewPrice } from './prices.repository';

/** The exclusive-arc check on the table guarantees that exactly one of the two ids is set. */
const targetOf = (price: Price): ContentTarget =>
  price.trackId ? { kind: 'TRACK', id: price.trackId } : { kind: 'PROGRAM', id: price.programId as string };

/** What is on sale and for how much. Read by the catalog; written by the admin pricing flow. */
@Injectable()
export class PricingService {
  constructor(private readonly repository: PricesRepository) {}

  async bookFor(trackIds: string[], programIds: string[]): Promise<PriceBook> {
    const byTarget = new Map<string, Prices>();
    for (const price of await this.repository.findActiveFor(trackIds, programIds)) {
      const key = targetKey(targetOf(price));
      const entry = { amountMinor: price.amountMinor, currency: price.currency };
      const current = byTarget.get(key) ?? NO_PRICES;
      byTarget.set(key, price.interval === 'MONTH' ? { ...current, month: entry } : { ...current, year: entry });
    }
    return new PriceBook(byTarget);
  }

  async pricesOf(target: ContentTarget): Promise<Prices> {
    const book = await this.bookFor(target.kind === 'TRACK' ? [target.id] : [], target.kind === 'PROGRAM' ? [target.id] : []);
    return book.for(target);
  }

  findActive(target: ContentTarget, interval: BillingInterval): Promise<Price | null> {
    return this.repository.findActive(target, interval);
  }

  findByStripePriceId(stripePriceId: string): Promise<Price | null> {
    return this.repository.findByStripePriceId(stripePriceId);
  }

  replaceActive(target: ContentTarget, interval: BillingInterval, price: NewPrice): Promise<Price> {
    return this.repository.replaceActive(target, interval, price);
  }

  deactivate(id: string): Promise<void> {
    return this.repository.deactivate(id);
  }
}
