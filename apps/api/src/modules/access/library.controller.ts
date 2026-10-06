import { Controller, Get, Param } from '@nestjs/common';
import { idParamSchema, libraryProgramDetailSchema, librarySchema } from '@mirsonix/shared';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LibraryService } from './library.service';

class LibraryDto extends createZodDto(librarySchema) {}
class LibraryProgramDetailDto extends createZodDto(libraryProgramDetailSchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @ZodSerializerDto(LibraryDto)
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.library.get(user.id);
  }

  @Get('programs/:id')
  @ZodSerializerDto(LibraryProgramDetailDto)
  program(@CurrentUser() user: AuthenticatedUser, @Param() { id }: IdParamDto) {
    return this.library.program(user.id, id);
  }
}
