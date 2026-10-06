import { Body, Controller, Param, Put } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { IdParamDto, PricesDto, SetPricesDto } from './billing.dto';
import { PricingAdminService } from './pricing-admin.service';

@Roles('ADMIN')
@Controller('admin')
export class PricingAdminController {
  constructor(private readonly pricing: PricingAdminService) {}

  @Put('tracks/:id/prices')
  @ZodSerializerDto(PricesDto)
  setTrackPrices(@CurrentUser() admin: AuthenticatedUser, @Param() { id }: IdParamDto, @Body() body: SetPricesDto) {
    return this.pricing.setPrices(admin.id, { kind: 'TRACK', id }, body);
  }

  @Put('programs/:id/prices')
  @ZodSerializerDto(PricesDto)
  setProgramPrices(@CurrentUser() admin: AuthenticatedUser, @Param() { id }: IdParamDto, @Body() body: SetPricesDto) {
    return this.pricing.setPrices(admin.id, { kind: 'PROGRAM', id }, body);
  }
}
