import { ContentStatus } from '@mirsonix/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { EnumColumn, Timestamps } from '../../../database/columns';
import { MediaAsset } from '../../media/entities/media-asset.entity';
import { User } from '../../users/entities/user.entity';
import { ProgramTrack } from './program-track.entity';

@Entity('programs')
export class Program extends Timestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'uuid', nullable: true })
  posterAssetId: string | null;

  @ManyToOne(() => MediaAsset, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'poster_asset_id' })
  posterAsset: Relation<MediaAsset> | null;

  @Index()
  @EnumColumn('program_status', ContentStatus.values, { default: 'DRAFT' })
  status: ContentStatus;

  @Column({ type: 'varchar', length: 64, unique: true, nullable: true })
  stripeProductId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Relation<User>;

  @OneToMany(() => ProgramTrack, (pt) => pt.program)
  programTracks: Relation<ProgramTrack[]>;
}
