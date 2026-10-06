import type { Prices } from '@mirsonix/shared';
import { targetKey, type ContentTarget } from '../../common/content-target';

export const NO_PRICES: Prices = { month: null, year: null };

/** The prices of a page of items, looked up by target. An item with nothing on sale simply has no prices. */
export class PriceBook {
  constructor(private readonly byTarget: ReadonlyMap<string, Prices> = new Map()) {}

  for(target: ContentTarget): Prices {
    return this.byTarget.get(targetKey(target)) ?? NO_PRICES;
  }
}
