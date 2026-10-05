import { Controller, Get } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';
import { Public } from '../auth/decorators/public.decorator';
import { HealthResponseDto } from './health.dto';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ZodSerializerDto(HealthResponseDto)
  check() {
    return this.health.check();
  }
}
