import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { CatalogModule } from '../catalog/catalog.module';
import { MediaModule } from '../media/media.module';
import { StreamingController } from './streaming.controller';
import { StreamingService } from './streaming.service';

@Module({
  imports: [AccessModule, CatalogModule, MediaModule],
  controllers: [StreamingController],
  providers: [StreamingService],
})
export class StreamingModule {}
