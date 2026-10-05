import { confirmUploadSchema, createUploadSchema, idParamSchema, mediaAssetSchema, uploadTicketSchema } from '@mirsonix/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateUploadDto extends createZodDto(createUploadSchema) {}
export class UploadTicketDto extends createZodDto(uploadTicketSchema) {}
export class ConfirmUploadDto extends createZodDto(confirmUploadSchema) {}
export class MediaAssetDto extends createZodDto(mediaAssetSchema) {}
export class IdParamDto extends createZodDto(idParamSchema) {}
