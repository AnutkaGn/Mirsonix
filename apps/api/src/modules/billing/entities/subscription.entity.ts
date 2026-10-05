import { SubscriptionStatus } from '@mirsonix/shared';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { EnumColumn, Timestamps } from '../../../database/columns';
import { Program } from '../../catalog/entities/program.entity';
import { Track } from '../../catalog/entities/track.entity';
import { User } from '../../users/entities/user.entity';
import { Price } from './price.entity';

/** A non-terminal subscription. Terminal ones (canceled, incomplete_expired) may repeat per target. */
const LIVE = `"status" NOT IN ('CANCELED', 'INCOMPLETE_EXPIRED')`;

/**
 * One subscription targets exactly one of track / program.
 * The partial unique indexes make a double purchase of the same item impossible at the DB level.
 */
@Entity('subscriptions')
@Check('chk_subscriptions_target_xor', 'num_nonnulls("track_id", "program_id") = 1')
@Index('uq_subscriptions_live_user_track', ['userId', 'trackId'], {
  unique: true,
  where: `"track_id" IS NOT NULL AND ${LIVE}`,
})
@Index('uq_subscriptions_live_user_program', ['userId', 'programId'], {
  unique: true,
  where: `"program_id" IS NOT NULL AND ${LIVE}`,
})
@Index('idx_subscriptions_user_status', ['userId', 'status'])
export class Subscription extends Timestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ type: 'uuid', nullable: true })
  trackId: string | null;

  @ManyToOne(() => Track, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'track_id' })
  track: Relation<Track> | null;

  @Column({ type: 'uuid', nullable: true })
  programId: string | null;

  @ManyToOne(() => Program, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'program_id' })
  program: Relation<Program> | null;

  @Column({ type: 'uuid' })
  priceId: string;

  @ManyToOne(() => Price, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'price_id' })
  price: Relation<Price>;

  @Column({ type: 'varchar', length: 64, unique: true })
  stripeSubscriptionId: string;

  @EnumColumn('subscription_status', SubscriptionStatus.values)
  status: SubscriptionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodStart: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  canceledAt: Date | null;
}
