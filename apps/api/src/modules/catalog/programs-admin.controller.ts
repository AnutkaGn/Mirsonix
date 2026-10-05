import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  AdminProgramDetailDto,
  AdminProgramListDto,
  AdminProgramListQueryDto,
  CreateProgramDto,
  IdParamDto,
  SetProgramTracksDto,
  UpdateProgramDto,
} from './catalog.dto';
import { ProgramsAdminService } from './programs-admin.service';

@Roles('ADMIN')
@Controller('admin/programs')
export class ProgramsAdminController {
  constructor(private readonly programs: ProgramsAdminService) {}

  @Get()
  @ZodSerializerDto(AdminProgramListDto)
  list(@Query() query: AdminProgramListQueryDto) {
    return this.programs.list(query);
  }

  @Get(':id')
  @ZodSerializerDto(AdminProgramDetailDto)
  get(@Param() { id }: IdParamDto) {
    return this.programs.get(id);
  }

  @Post()
  @ZodSerializerDto(AdminProgramDetailDto)
  create(@CurrentUser() admin: AuthenticatedUser, @Body() body: CreateProgramDto) {
    return this.programs.create(admin.id, body);
  }

  @Patch(':id')
  @ZodSerializerDto(AdminProgramDetailDto)
  update(@CurrentUser() admin: AuthenticatedUser, @Param() { id }: IdParamDto, @Body() body: UpdateProgramDto) {
    return this.programs.update(admin.id, id, body);
  }

  /** The program builder: send the full ordered list of track ids. */
  @Put(':id/tracks')
  @ZodSerializerDto(AdminProgramDetailDto)
  setTracks(@CurrentUser() admin: AuthenticatedUser, @Param() { id }: IdParamDto, @Body() body: SetProgramTracksDto) {
    return this.programs.setTracks(admin.id, id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/publish')
  @ZodSerializerDto(AdminProgramDetailDto)
  publish(@CurrentUser() admin: AuthenticatedUser, @Param() { id }: IdParamDto) {
    return this.programs.publish(admin.id, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/archive')
  @ZodSerializerDto(AdminProgramDetailDto)
  archive(@CurrentUser() admin: AuthenticatedUser, @Param() { id }: IdParamDto) {
    return this.programs.archive(admin.id, id);
  }
}
