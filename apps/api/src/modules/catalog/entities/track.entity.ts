import { ContentStatus, WaveType } from '@mirsonix/shared';
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { EnumColumn, Timestamps } from '../../../database/columns';
import { numberTransformer } from '../../../database/transformers';
import { MediaAsset } from '../../media/entities/media-asset.entity';
import { User } from '../../users/entities/user.entity';
import { ProgramTrack } from './program-track.entity';
import { TrackIssue } from './track-issue.entity';
import { TrackMeridian } from './track-meridian.entity';

@Entity('tracks')
@Check('chk_tracks_duration_positive', '"duration_sec" > 0')
@Check('chk_tracks_frequency_positive', '"frequency_hz" IS NULL OR "frequency_hz" > 0')
export class Track extends Timestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int' })
  durationSec: number;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true, transformer: numberTransformer })
  frequencyHz: number | null;

  @EnumColumn('wave_type', WaveType.values, { nullable: true })
  waveType: WaveType | null;

  @Column({ type: 'uuid' })
  audioAssetId: string;

  @ManyToOne(() => MediaAsset, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'audio_asset_id' })
  audioAsset: Relation<MediaAsset>;

  @Column({ type: 'uuid', nullable: true })
  coverAssetId: string | null;

  @ManyToOne(() => MediaAsset, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cover_asset_id' })
  coverAsset: Relation<MediaAsset> | null;

  @Index()
  @EnumColumn('track_status', ContentStatus.values, { default: 'DRAFT' })
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

  @OneToMany(() => TrackMeridian, (tm) => tm.track)
  trackMeridians: Relation<TrackMeridian[]>;

  @OneToMany(() => TrackIssue, (ti) => ti.track)
  trackIssues: Relation<TrackIssue[]>;

  @OneToMany(() => ProgramTrack, (pt) => pt.track)
  programTracks: Relation<ProgramTrack[]>;
}
