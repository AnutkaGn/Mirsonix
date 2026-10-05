import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';
import { CatalogReadService } from './catalog-read.service';
import { ProgramDetailDto, ProgramListDto, ProgramListQueryDto, SlugParamDto, TaxonomyDto, TrackListDto, TrackListQueryDto, TrackSummaryDto } from './catalog.dto';

/** Browsing for any signed-in user. There is no public catalog: the global guard requires a login. */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogReadService) {}

  @Get('taxonomy')
  @ZodSerializerDto(TaxonomyDto)
  taxonomy() {
    return this.catalog.taxonomy();
  }

  @Get('tracks')
  @ZodSerializerDto(TrackListDto)
  listTracks(@Query() query: TrackListQueryDto) {
    return this.catalog.listTracks(query);
  }

  @Get('tracks/:slug')
  @ZodSerializerDto(TrackSummaryDto)
  getTrack(@Param() { slug }: SlugParamDto) {
    return this.catalog.getTrack(slug);
  }

  @Get('programs')
  @ZodSerializerDto(ProgramListDto)
  listPrograms(@Query() query: ProgramListQueryDto) {
    return this.catalog.listPrograms(query);
  }

  @Get('programs/:slug')
  @ZodSerializerDto(ProgramDetailDto)
  getProgram(@Param() { slug }: SlugParamDto) {
    return this.catalog.getProgram(slug);
  }
}
