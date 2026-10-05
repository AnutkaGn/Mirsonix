import { MediaKind, MediaStatus } from '@mirsonix/shared';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, type Relation } from 'typeorm';
import { EnumColumn, Timestamps } from '../../../database/columns';
import { numberTransformer } from '../../../database/transformers';
import { User } from '../../users/entities/user.entity';

@Entity('media_assets')
@Unique(['bucket', 's3Key'])
export class MediaAsset extends Timestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @EnumColumn('media_kind', MediaKind.values)
  kind: MediaKind;

  @Column({ type: 'varchar', length: 255 })
  bucket: string;

  @Column({ type: 'varchar', length: 1024 })
  s3Key: string;

  @Column({ type: 'varchar', length: 127 })
  mimeType: string;

  @Column({ type: 'bigint', transformer: numberTransformer })
  sizeBytes: number;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @EnumColumn('media_status', MediaStatus.values, { default: 'PENDING' })
  status: MediaStatus;

  @Column({ type: 'uuid' })
  uploadedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: Relation<User>;
}
