import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Price } from '../billing/entities/price.entity';
import { PricesRepository } from './prices.repository';
import { PricingService } from './pricing.service';

@Module({
  imports: [TypeOrmModule.forFeature([Price])],
  providers: [PricesRepository, PricingService],
  exports: [PricingService],
})
export class PricingModule {}
