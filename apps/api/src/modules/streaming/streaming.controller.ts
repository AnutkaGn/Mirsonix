import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { idParamSchema, streamUrlSchema } from '@mirsonix/shared';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StreamingService } from './streaming.service';

class StreamUrlDto extends createZodDto(streamUrlSchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

@Controller('stream')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class StreamingController {
  constructor(private readonly streaming: StreamingService) {}

  /** POST, so a signed URL is never cached or prefetched by an intermediary. Each call issues a fresh one. */
  @HttpCode(HttpStatus.OK)
  @Post('tracks/:id/url')
  @ZodSerializerDto(StreamUrlDto)
  trackUrl(@CurrentUser() user: AuthenticatedUser, @Param() { id }: IdParamDto) {
    return this.streaming.issueTrackUrl(user.id, id);
  }
}
