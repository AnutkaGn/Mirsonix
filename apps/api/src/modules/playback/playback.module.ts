import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PlaybackController } from './playback.controller';
import { PlaybackRepository } from './playback.repository';
import { PlaybackService } from './playback.service';
import { PlaybackProgress } from './entities/playback-progress.entity';
import { PlaybackSession } from './entities/playback-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlaybackSession, PlaybackProgress]), AccessModule, CatalogModule],
  controllers: [PlaybackController],
  providers: [PlaybackRepository, PlaybackService],
})
export class PlaybackModule {}
