import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn, type Relation } from 'typeorm';
import { Track } from '../../catalog/entities/track.entity';
import { User } from '../../users/entities/user.entity';

/** Resume position per user and track. */
@Entity('playback_progress')
export class PlaybackProgress {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'uuid' })
  trackId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @ManyToOne(() => Track, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'track_id' })
  track: Relation<Track>;

  @Column({ type: 'int', default: 0 })
  positionSec: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
