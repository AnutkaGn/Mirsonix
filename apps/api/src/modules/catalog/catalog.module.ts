import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { MediaModule } from '../media/media.module';
import { PricingModule } from '../pricing/pricing.module';
import { CatalogReadService } from './catalog-read.service';
import { CatalogController } from './catalog.controller';
import { ContentLookupService } from './content-lookup.service';
import { Element } from './entities/element.entity';
import { Issue } from './entities/issue.entity';
import { Meridian } from './entities/meridian.entity';
import { ProgramTrack } from './entities/program-track.entity';
import { Program } from './entities/program.entity';
import { TrackIssue } from './entities/track-issue.entity';
import { TrackMeridian } from './entities/track-meridian.entity';
import { Track } from './entities/track.entity';
import { ProgramsAdminController } from './programs-admin.controller';
import { ProgramsAdminService } from './programs-admin.service';
import { ProgramsRepository } from './programs.repository';
import { TaxonomyRepository } from './taxonomy.repository';
import { TracksAdminController } from './tracks-admin.controller';
import { TracksAdminService } from './tracks-admin.service';
import { TracksRepository } from './tracks.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Track, Program, ProgramTrack, TrackMeridian, TrackIssue, Element, Meridian, Issue]),
    MediaModule,
    PricingModule,
    AuditModule,
  ],
  controllers: [CatalogController, TracksAdminController, ProgramsAdminController],
  providers: [
    TracksRepository,
    ProgramsRepository,
    TaxonomyRepository,
    CatalogReadService,
    ContentLookupService,
    TracksAdminService,
    ProgramsAdminService,
  ],
  exports: [CatalogReadService, ContentLookupService],
})
export class CatalogModule {}
