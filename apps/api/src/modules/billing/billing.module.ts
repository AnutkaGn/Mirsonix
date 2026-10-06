import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { UsersModule } from '../users/users.module';
import { BillingController } from './billing.controller';
import { CheckoutService } from './checkout.service';
import { Invoice } from './entities/invoice.entity';
import { StripeEvent } from './entities/stripe-event.entity';
import { Subscription } from './entities/subscription.entity';
import { ChargeEventHandler } from './handlers/charge-event.handler';
import { InvoiceEventHandler } from './handlers/invoice-event.handler';
import { SubscriptionEventHandler } from './handlers/subscription-event.handler';
import { InvoicesRepository } from './invoices.repository';
import { PricingAdminController } from './pricing-admin.controller';
import { PricingAdminService } from './pricing-admin.service';
import { STRIPE_EVENT_HANDLERS } from './stripe-event-handler';
import { StripeEventsRepository } from './stripe-events.repository';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Invoice, StripeEvent]),
    UsersModule,
    CatalogModule,
    PricingModule,
    PaymentsModule,
    AuditModule,
  ],
  controllers: [BillingController, WebhookController, PricingAdminController],
  providers: [
    SubscriptionsRepository,
    InvoicesRepository,
    StripeEventsRepository,
    SubscriptionsService,
    CheckoutService,
    PricingAdminService,
    WebhookService,
    SubscriptionEventHandler,
    InvoiceEventHandler,
    ChargeEventHandler,
    {
      provide: STRIPE_EVENT_HANDLERS,
      useFactory: (...handlers: unknown[]) => handlers,
      inject: [SubscriptionEventHandler, InvoiceEventHandler, ChargeEventHandler],
    },
  ],
})
export class BillingModule {}
