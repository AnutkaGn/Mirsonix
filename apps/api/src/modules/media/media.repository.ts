import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MediaAsset } from './entities/media-asset.entity';

@Injectable()
export class MediaRepository {
  constructor(@InjectRepository(MediaAsset) private readonly repo: Repository<MediaAsset>) {}

  create(data: Pick<MediaAsset, 'kind' | 'bucket' | 's3Key' | 'mimeType' | 'sizeBytes' | 'uploadedById'>): Promise<MediaAsset> {
    return this.repo.save(this.repo.create({ ...data, status: 'PENDING' }));
  }

  findById(id: string): Promise<MediaAsset | null> {
    return this.repo.findOneBy({ id });
  }

  findByIds(ids: string[]): Promise<MediaAsset[]> {
    return ids.length ? this.repo.findBy({ id: In(ids) }) : Promise.resolve([]);
  }

  async markReady(id: string, patch: Pick<MediaAsset, 'sizeBytes' | 'durationMs'>): Promise<void> {
    await this.repo.update(id, { ...patch, status: 'READY' });
  }

  async markFailed(id: string): Promise<void> {
    await this.repo.update(id, { status: 'FAILED' });
  }
}
