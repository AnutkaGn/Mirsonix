import { AccessGrantSource } from '@mirsonix/shared';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { EnumColumn } from '../../../database/columns';
import { Program } from '../../catalog/entities/program.entity';
import { Track } from '../../catalog/entities/track.entity';
import { User } from '../../users/entities/user.entity';

/** Manual access (support, promo) that bypasses billing. Exactly one of track_id / program_id is set. */
@Entity('access_grants')
@Check('chk_access_grants_target_xor', 'num_nonnulls("track_id", "program_id") = 1')
export class AccessGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ type: 'uuid', nullable: true })
  trackId: string | null;

  @ManyToOne(() => Track, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'track_id' })
  track: Relation<Track> | null;

  @Column({ type: 'uuid', nullable: true })
  programId: string | null;

  @ManyToOne(() => Program, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'program_id' })
  program: Relation<Program> | null;

  @EnumColumn('access_grant_source', AccessGrantSource.values)
  source: AccessGrantSource;

  /** Null = does not expire. */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid' })
  grantedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'granted_by_id' })
  grantedBy: Relation<User>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
