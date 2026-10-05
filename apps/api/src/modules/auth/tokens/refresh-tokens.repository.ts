import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RefreshToken } from '../../users/entities/refresh-token.entity';

@Injectable()
export class RefreshTokensRepository {
  constructor(@InjectRepository(RefreshToken) private readonly repo: Repository<RefreshToken>) {}

  create(data: Pick<RefreshToken, 'userId' | 'tokenHash' | 'familyId' | 'expiresAt' | 'userAgent' | 'ip'>) {
    return this.repo.save(this.repo.create(data));
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repo.findOneBy({ tokenHash });
  }

  /** Atomic compare-and-set: of two concurrent rotations of the same token exactly one gets `true`. */
  async revokeIfActive(id: string, at: Date): Promise<boolean> {
    const result = await this.repo.update({ id, revokedAt: IsNull() }, { revokedAt: at });
    return (result.affected ?? 0) === 1;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.repo.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}
