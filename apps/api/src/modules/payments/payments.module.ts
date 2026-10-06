import { Module } from '@nestjs/common';
import { PaymentsPort } from './payments.port';
import { StripePaymentsService } from './stripe-payments.service';

@Module({
  providers: [{ provide: PaymentsPort, useClass: StripePaymentsService }],
  exports: [PaymentsPort],
})
export class PaymentsModule {}
