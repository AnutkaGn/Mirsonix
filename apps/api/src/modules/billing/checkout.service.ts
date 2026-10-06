import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CHECKOUT_RETURN_PATHS, type CheckoutRequest, type RedirectUrl } from '@mirsonix/shared';
import type { ContentTarget } from '../../common/content-target';
import { AppConfig } from '../../config/app-config.module';
import { ContentLookupService } from '../catalog/content-lookup.service';
import { PaymentsPort } from '../payments/payments.port';
import { PricingService } from '../pricing/pricing.service';
import type { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { SubscriptionsRepository } from './subscriptions.repository';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly users: UsersService,
    private readonly content: ContentLookupService,
    private readonly pricing: PricingService,
    private readonly subscriptions: SubscriptionsRepository,
    private readonly payments: PaymentsPort,
    private readonly config: AppConfig,
  ) {}

  /**
   * Starts a subscription purchase. Everything that matters is decided here from our own data: the price comes from
   * the database, never from the client, and the user comes from the verified token.
   */
  async createCheckout(userId: string, request: CheckoutRequest): Promise<RedirectUrl> {
    this.assertConfigured();
    const target: ContentTarget = request.trackId ? { kind: 'TRACK', id: request.trackId } : { kind: 'PROGRAM', id: request.programId as string };

    const item = await this.content.basics(target);
    // Drafts and archived items are not for sale. Answer as if they did not exist, so drafts are not discoverable.
    if (item.status !== 'PUBLISHED') throw new NotFoundException('This item is not available');

    const price = await this.pricing.findActive(target, request.interval);
    if (!price) throw new UnprocessableEntityException('This item is not available for that billing interval');
    if (await this.subscriptions.findLive(userId, target)) throw new ConflictException('You already subscribe to this item');

    const user = await this.requireUser(userId);
    const customerId = user.stripeCustomerId ?? (await this.createCustomer(user));
    const web = this.config.get('WEB_ORIGIN');
    const url = await this.payments.createCheckoutSession({
      customerId,
      priceId: price.stripePriceId,
      userId,
      successUrl: `${web}${CHECKOUT_RETURN_PATHS.success}`,
      cancelUrl: `${web}${CHECKOUT_RETURN_PATHS.cancel}`,
      metadata: { userId, targetKind: target.kind, targetId: target.id },
    });
    return { url };
  }

  /** The hosted page where a customer cancels, switches plan or updates their card. */
  async createPortal(userId: string): Promise<RedirectUrl> {
    this.assertConfigured();
    const user = await this.requireUser(userId);
    if (!user.stripeCustomerId) throw new NotFoundException('You have no billing account yet');

    const url = await this.payments.createPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${this.config.get('WEB_ORIGIN')}${CHECKOUT_RETURN_PATHS.portal}`,
    });
    return { url };
  }

  private async createCustomer(user: User): Promise<string> {
    const customerId = await this.payments.createCustomer({ userId: user.id, email: user.email });
    await this.users.update(user.id, { stripeCustomerId: customerId });
    return customerId;
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(); // the account was removed after the token was issued
    return user;
  }

  private assertConfigured(): void {
    if (!this.payments.isConfigured()) throw new ServiceUnavailableException('Payments are not configured');
  }
}
