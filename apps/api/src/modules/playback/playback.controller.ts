import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { heartbeatResultSchema, heartbeatSchema, idParamSchema, sessionStartedSchema, startSessionSchema } from '@mirsonix/shared';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlaybackService } from './playback.service';

class StartSessionDto extends createZodDto(startSessionSchema) {}
class SessionStartedDto extends createZodDto(sessionStartedSchema) {}
class HeartbeatDto extends createZodDto(heartbeatSchema) {}
class HeartbeatResultDto extends createZodDto(heartbeatResultSchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

@Controller('playback/sessions')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class PlaybackController {
  constructor(private readonly playback: PlaybackService) {}

  @Post()
  @ZodSerializerDto(SessionStartedDto)
  start(@CurrentUser() user: AuthenticatedUser, @Body() body: StartSessionDto) {
    return this.playback.startSession(user.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/heartbeat')
  @ZodSerializerDto(HeartbeatResultDto)
  heartbeat(@CurrentUser() user: AuthenticatedUser, @Param() { id }: IdParamDto, @Body() body: HeartbeatDto) {
    return this.playback.heartbeat(user.id, id, body);
  }
}
