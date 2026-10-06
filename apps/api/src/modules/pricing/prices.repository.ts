import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { BillingInterval } from '@mirsonix/shared';
import { Brackets, Repository } from 'typeorm';
import type { ContentTarget } from '../../common/content-target';
import { Price } from '../billing/entities/price.entity';

export interface NewPrice {
  stripePriceId: string;
  amountMinor: number;
  currency: string;
}

const targetColumns = (target: ContentTarget) =>
  target.kind === 'TRACK' ? { trackId: target.id } : { programId: target.id };

@Injectable()
export class PricesRepository {
  constructor(@InjectRepository(Price) private readonly prices: Repository<Price>) {}

  /** Active prices of many items in one query, so a listing never costs one query per card. */
  findActiveFor(trackIds: string[], programIds: string[]): Promise<Price[]> {
    if (!trackIds.length && !programIds.length) return Promise.resolve([]);
    return this.prices
      .createQueryBuilder('p')
      .where('p.isActive = true')
      .andWhere(
        new Brackets((qb) => {
          if (trackIds.length) qb.where('p.trackId IN (:...trackIds)', { trackIds });
          if (programIds.length) qb.orWhere('p.programId IN (:...programIds)', { programIds });
        }),
      )
      .getMany();
  }

  findActive(target: ContentTarget, interval: BillingInterval): Promise<Price | null> {
    return this.prices.findOneBy({ ...targetColumns(target), interval, isActive: true });
  }

  /** Any price, active or retired: a subscription may still be running on a price that is no longer on sale. */
  findByStripePriceId(stripePriceId: string): Promise<Price | null> {
    return this.prices.findOneBy({ stripePriceId });
  }

  /** Puts a new price on sale and retires the one it replaces, in one transaction (the unique index allows only one). */
  replaceActive(target: ContentTarget, interval: BillingInterval, price: NewPrice): Promise<Price> {
    return this.prices.manager.transaction(async (em) => {
      await em.update(Price, { ...targetColumns(target), interval, isActive: true }, { isActive: false });
      return em.save(
        Price,
        em.create(Price, {
          trackId: target.kind === 'TRACK' ? target.id : null,
          programId: target.kind === 'PROGRAM' ? target.id : null,
          interval,
          ...price,
          isActive: true,
        }),
      );
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.prices.update(id, { isActive: false });
  }
}
