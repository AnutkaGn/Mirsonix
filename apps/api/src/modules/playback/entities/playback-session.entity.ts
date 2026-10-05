import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Program } from '../../catalog/entities/program.entity';
import { Track } from '../../catalog/entities/track.entity';
import { User } from '../../users/entities/user.entity';

/** One continuous listen of a track. Feeds the "top tracks / programs by listens" statistics. */
@Entity('playback_sessions')
@Index('idx_playback_sessions_track_started', ['trackId', 'startedAt'])
@Index('idx_playback_sessions_user_started', ['userId', 'startedAt'])
@Index('idx_playback_sessions_counted_track', ['trackId'], { where: '"counted_as_listen" = true' })
export class PlaybackSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ type: 'uuid' })
  trackId: string;

  @ManyToOne(() => Track, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'track_id' })
  track: Relation<Track>;

  /** Set when played from within a program, so program statistics can be derived. */
  @Column({ type: 'uuid', nullable: true })
  programId: string | null;

  @ManyToOne(() => Program, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'program_id' })
  program: Relation<Program> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastHeartbeatAt: Date | null;

  @Column({ type: 'int', default: 0 })
  listenedSec: number;

  /** Flipped once when the listen threshold is reached, so a session is counted at most once. */
  @Column({ type: 'boolean', default: false })
  countedAsListen: boolean;
}
