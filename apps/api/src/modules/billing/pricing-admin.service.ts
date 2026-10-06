import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { CURRENCY, type BillingInterval, type Prices, type SetPricesInput } from '@mirsonix/shared';
import type { ContentTarget } from '../../common/content-target';
import { AuditService } from '../audit/audit.service';
import { ContentLookupService } from '../catalog/content-lookup.service';
import { PaymentsPort } from '../payments/payments.port';
import { PricingService } from '../pricing/pricing.service';

const AUDIT_ENTITY = { TRACK: 'track', PROGRAM: 'program' } as const;

/** Sets what an item costs. Stripe prices cannot be edited, so a change puts a new price on sale and retires the old. */
@Injectable()
export class PricingAdminService {
  private readonly logger = new Logger(PricingAdminService.name);

  constructor(
    private readonly content: ContentLookupService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsPort,
    private readonly audit: AuditService,
  ) {}

  async setPrices(adminId: string, target: ContentTarget, input: SetPricesInput): Promise<Prices> {
    if (!this.payments.isConfigured()) throw new ServiceUnavailableException('Payments are not configured');
    const item = await this.content.basics(target); // 404 for an unknown item

    const requested: Record<BillingInterval, number | null> = { MONTH: input.monthlyAmountMinor, YEAR: input.yearlyAmountMinor };
    let productId = item.stripeProductId;
    for (const interval of ['MONTH', 'YEAR'] as const) {
      const amountMinor = requested[interval];
      const current = await this.pricing.findActive(target, interval);
      if (current?.amountMinor === amountMinor) continue; // nothing to change, and no new Stripe price to pay for in clutter

      if (amountMinor === null) {
        if (current) await this.retire(current.id, current.stripePriceId);
        continue;
      }
      productId ??= await this.createProduct(target, item.title, item.description);
      const stripePriceId = await this.payments.createPrice({ productId, amountMinor, currency: CURRENCY, interval });
      await this.pricing.replaceActive(target, interval, { stripePriceId, amountMinor, currency: CURRENCY });
      if (current) await this.archiveInStripe(current.stripePriceId);
    }

    await this.audit.record({
      adminId,
      action: `${AUDIT_ENTITY[target.kind]}.set-prices`,
      entityType: AUDIT_ENTITY[target.kind],
      entityId: target.id,
      metadata: { monthlyAmountMinor: input.monthlyAmountMinor, yearlyAmountMinor: input.yearlyAmountMinor },
    });
    return this.pricing.pricesOf(target);
  }

  private async createProduct(target: ContentTarget, name: string, description: string): Promise<string> {
    const productId = await this.payments.createProduct({ name, description });
    await this.content.setStripeProductId(target, productId);
    return productId;
  }

  private async retire(priceId: string, stripePriceId: string): Promise<void> {
    await this.pricing.deactivate(priceId);
    await this.archiveInStripe(stripePriceId);
  }

  /** Our table already says the price is off sale, so a Stripe failure here is logged, not allowed to undo that. */
  private async archiveInStripe(stripePriceId: string): Promise<void> {
    try {
      await this.payments.archivePrice(stripePriceId);
    } catch (error) {
      this.logger.warn(`Could not archive Stripe price ${stripePriceId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
