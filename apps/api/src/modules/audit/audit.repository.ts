import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditRepository {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async insert(entry: Pick<AuditLog, 'adminId' | 'action' | 'entityType' | 'entityId' | 'metadata'>): Promise<void> {
    await this.repo.save(this.repo.create(entry));
  }
}
