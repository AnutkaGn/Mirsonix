import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  AdminTrackDto,
  AdminTrackListDto,
  AdminTrackListQueryDto,
  AudioPreviewDto,
  CreateTrackDto,
  IdParamDto,
  UpdateTrackDto,
} from './catalog.dto';
import { TracksAdminService } from './tracks-admin.service';

@Roles('ADMIN')
@Controller('admin/tracks')
export class TracksAdminController {
  constructor(private readonly tracks: TracksAdminService) {}

  @Get()
  @ZodSerializerDto(AdminTrackListDto)
  list(@Query() query: AdminTrackListQueryDto) {
    return this.tracks.list(query);
  }

  @Get(':id')
  @ZodSerializerDto(AdminTrackDto)
  get(@Param() { id }: IdParamDto) {
    return this.tracks.get(id);
  }

  @Post()
  @ZodSerializerDto(AdminTrackDto)
  create(@CurrentUser() admin: AuthenticatedUser, @Body() body: CreateTrackDto) {
    return this.tracks.create(admin.id, body);
  }

  @Patch(':id')
  @ZodSerializerDto(AdminTrackDto)
  update(@CurrentUser() admin: AuthenticatedUser, @Param() { id }: IdParamDto, @Body() body: UpdateTrackDto) {
    return this.tracks.update(admin.id, id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/publish')
  @ZodSerializerDto(AdminTrackDto)
  publish(@CurrentUser() admin: AuthenticatedUser, @Param() { id }: IdParamDto) {
    return this.tracks.publish(admin.id, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/archive')
  @ZodSerializerDto(AdminTrackDto)
  archive(@CurrentUser() admin: AuthenticatedUser, @Param() { id }: IdParamDto) {
    return this.tracks.archive(admin.id, id);
  }

  @Get(':id/audio-preview')
  @ZodSerializerDto(AudioPreviewDto)
  audioPreview(@Param() { id }: IdParamDto) {
    return this.tracks.audioPreview(id);
  }
}
