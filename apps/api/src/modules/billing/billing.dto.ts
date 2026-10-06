import { checkoutRequestSchema, idParamSchema, pricesSchema, redirectUrlSchema, setPricesSchema } from '@mirsonix/shared';
import { createZodDto } from 'nestjs-zod';

export class CheckoutRequestDto extends createZodDto(checkoutRequestSchema) {}
export class RedirectUrlDto extends createZodDto(redirectUrlSchema) {}
export class SetPricesDto extends createZodDto(setPricesSchema) {}
export class PricesDto extends createZodDto(pricesSchema) {}
export class IdParamDto extends createZodDto(idParamSchema) {}
