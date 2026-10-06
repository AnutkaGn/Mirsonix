import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { UsersModule } from '../users/users.module';
import { AccessGrantsController } from './access-grants.controller';
import { AccessGrantsRepository } from './access-grants.repository';
import { AccessGrantsService } from './access-grants.service';
import { AccessRepository } from './access.repository';
import { AccessService } from './access.service';
import { AccessGrant } from './entities/access-grant.entity';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccessGrant]), CatalogModule, UsersModule, AuditModule],
  controllers: [LibraryController, AccessGrantsController],
  providers: [AccessRepository, AccessService, LibraryService, AccessGrantsRepository, AccessGrantsService],
  exports: [AccessService],
})
export class AccessModule {}
