import { BillingInterval } from '@mirsonix/shared';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { EnumColumn } from '../../../database/columns';
import { Program } from '../../catalog/entities/program.entity';
import { Track } from '../../catalog/entities/track.entity';

/**
 * Stripe Prices are immutable, so a price change inserts a new row and deactivates the old one;
 * existing subscriptions keep pointing at the price they were sold on.
 * Exactly one of track_id / program_id is set.
 */
@Entity('prices')
@Check('chk_prices_target_xor', 'num_nonnulls("track_id", "program_id") = 1')
@Check('chk_prices_amount_positive', '"amount_minor" > 0')
@Index('uq_prices_active_track_interval', ['trackId', 'interval'], {
  unique: true,
  where: '"is_active" = true AND "track_id" IS NOT NULL',
})
@Index('uq_prices_active_program_interval', ['programId', 'interval'], {
  unique: true,
  where: '"is_active" = true AND "program_id" IS NOT NULL',
})
export class Price {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @EnumColumn('billing_interval', BillingInterval.values)
  interval: BillingInterval;

  @Column({ type: 'varchar', length: 64, unique: true })
  stripePriceId: string;

  /** Amount in minor units (cents). */
  @Column({ type: 'int' })
  amountMinor: number;

  @Column({ type: 'varchar', length: 3, default: 'usd' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
