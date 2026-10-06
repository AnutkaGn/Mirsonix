import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CheckoutRequestDto, RedirectUrlDto } from './billing.dto';
import { CheckoutService } from './checkout.service';

@Controller('billing')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class BillingController {
  constructor(private readonly checkout: CheckoutService) {}

  @HttpCode(HttpStatus.OK)
  @Post('checkout')
  @ZodSerializerDto(RedirectUrlDto)
  startCheckout(@CurrentUser() user: AuthenticatedUser, @Body() body: CheckoutRequestDto) {
    return this.checkout.createCheckout(user.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('portal')
  @ZodSerializerDto(RedirectUrlDto)
  openPortal(@CurrentUser() user: AuthenticatedUser) {
    return this.checkout.createPortal(user.id);
  }
}
