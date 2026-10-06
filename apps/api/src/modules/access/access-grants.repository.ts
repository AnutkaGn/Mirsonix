import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toOffset } from '../../common/pagination';
import { AccessGrant } from './entities/access-grant.entity';

export type NewAccessGrant = Pick<
  AccessGrant,
  'userId' | 'trackId' | 'programId' | 'source' | 'expiresAt' | 'note' | 'grantedById'
>;

@Injectable()
export class AccessGrantsRepository {
  constructor(@InjectRepository(AccessGrant) private readonly grants: Repository<AccessGrant>) {}

  async create(data: NewAccessGrant): Promise<string> {
    return (await this.grants.save(this.grants.create(data))).id;
  }

  findById(id: string): Promise<AccessGrant | null> {
    return this.grants.findOne({ where: { id }, relations: { user: true } });
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.grants.update(id, { revokedAt: at });
  }

  async search(filters: { userId?: string; page: number; limit: number }): Promise<{ items: AccessGrant[]; total: number }> {
    const [items, total] = await this.grants.findAndCount({
      where: filters.userId ? { userId: filters.userId } : {},
      relations: { user: true },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: toOffset(filters.page, filters.limit),
      take: filters.limit,
    });
    return { items, total };
  }
}
