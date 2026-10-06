import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { accessGrantListQuerySchema, accessGrantListSchema, accessGrantSchema, createAccessGrantSchema, idParamSchema } from '@mirsonix/shared';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessGrantsService } from './access-grants.service';

class CreateAccessGrantDto extends createZodDto(createAccessGrantSchema) {}
class AccessGrantDto extends createZodDto(accessGrantSchema) {}
class AccessGrantListQueryDto extends createZodDto(accessGrantListQuerySchema) {}
class AccessGrantListDto extends createZodDto(accessGrantListSchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

@Roles('ADMIN')
@Controller('admin/access-grants')
export class AccessGrantsController {
  constructor(private readonly grants: AccessGrantsService) {}

  @Post()
  @ZodSerializerDto(AccessGrantDto)
  create(@CurrentUser() admin: AuthenticatedUser, @Body() body: CreateAccessGrantDto) {
    return this.grants.create(admin.id, body);
  }

  @Get()
  @ZodSerializerDto(AccessGrantListDto)
  list(@Query() query: AccessGrantListQueryDto) {
    return this.grants.list(query);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/revoke')
  @ZodSerializerDto(AccessGrantDto)
  revoke(@CurrentUser() admin: AuthenticatedUser, @Param() { id }: IdParamDto) {
    return this.grants.revoke(admin.id, id);
  }
}
