import {
  adminProgramDetailSchema,
  adminProgramListQuerySchema,
  adminProgramListSchema,
  adminProgramSchema,
  adminTrackListQuerySchema,
  adminTrackListSchema,
  adminTrackSchema,
  audioPreviewSchema,
  createProgramSchema,
  createTrackSchema,
  idParamSchema,
  programDetailSchema,
  programListQuerySchema,
  programListSchema,
  setProgramTracksSchema,
  slugParamSchema,
  taxonomySchema,
  trackListQuerySchema,
  trackListSchema,
  trackSummarySchema,
  updateProgramSchema,
  updateTrackSchema,
} from '@mirsonix/shared';
import { createZodDto } from 'nestjs-zod';

export class IdParamDto extends createZodDto(idParamSchema) {}
export class SlugParamDto extends createZodDto(slugParamSchema) {}

export class TaxonomyDto extends createZodDto(taxonomySchema) {}
export class TrackListQueryDto extends createZodDto(trackListQuerySchema) {}
export class TrackListDto extends createZodDto(trackListSchema) {}
export class TrackSummaryDto extends createZodDto(trackSummarySchema) {}
export class ProgramListQueryDto extends createZodDto(programListQuerySchema) {}
export class ProgramListDto extends createZodDto(programListSchema) {}
export class ProgramDetailDto extends createZodDto(programDetailSchema) {}

export class CreateTrackDto extends createZodDto(createTrackSchema) {}
export class UpdateTrackDto extends createZodDto(updateTrackSchema) {}
export class AdminTrackDto extends createZodDto(adminTrackSchema) {}
export class AdminTrackListQueryDto extends createZodDto(adminTrackListQuerySchema) {}
export class AdminTrackListDto extends createZodDto(adminTrackListSchema) {}
export class AudioPreviewDto extends createZodDto(audioPreviewSchema) {}

export class CreateProgramDto extends createZodDto(createProgramSchema) {}
export class UpdateProgramDto extends createZodDto(updateProgramSchema) {}
export class SetProgramTracksDto extends createZodDto(setProgramTracksSchema) {}
export class AdminProgramDto extends createZodDto(adminProgramSchema) {}
export class AdminProgramDetailDto extends createZodDto(adminProgramDetailSchema) {}
export class AdminProgramListQueryDto extends createZodDto(adminProgramListQuerySchema) {}
export class AdminProgramListDto extends createZodDto(adminProgramListSchema) {}
