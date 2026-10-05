import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { MediaAsset } from './entities/media-asset.entity';
import { MediaController } from './media.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { S3StorageService } from './s3-storage.service';
import { StoragePort } from './storage.port';

@Module({
  imports: [TypeOrmModule.forFeature([MediaAsset]), AuditModule],
  controllers: [MediaController],
  providers: [MediaRepository, MediaService, { provide: StoragePort, useClass: S3StorageService }],
  exports: [MediaService],
})
export class MediaModule {}
