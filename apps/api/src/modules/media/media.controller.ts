import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ConfirmUploadDto, CreateUploadDto, IdParamDto, MediaAssetDto, UploadTicketDto } from './media.dto';
import { MediaService, toMediaAssetDto } from './media.service';

@Roles('ADMIN')
@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('uploads')
  @ZodSerializerDto(UploadTicketDto)
  createUpload(@CurrentUser() admin: AuthenticatedUser, @Body() body: CreateUploadDto) {
    return this.media.createUpload(admin.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('uploads/:id/confirm')
  @ZodSerializerDto(MediaAssetDto)
  async confirmUpload(@CurrentUser() admin: AuthenticatedUser, @Param() { id }: IdParamDto, @Body() body: ConfirmUploadDto) {
    return toMediaAssetDto(await this.media.confirmUpload(admin.id, id, body));
  }
}
