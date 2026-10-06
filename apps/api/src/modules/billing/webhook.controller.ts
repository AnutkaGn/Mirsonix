import { Controller, Headers, HttpCode, HttpStatus, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WebhookService } from './webhook.service';

@Controller('billing')
export class WebhookController {
  constructor(private readonly webhooks: WebhookService) {}

  /** Called by Stripe, not by a logged-in user: authenticity comes from the signature over the raw body. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('webhook')
  async receive(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string | undefined) {
    return { received: true, result: await this.webhooks.process(req.rawBody, signature) };
  }
}
