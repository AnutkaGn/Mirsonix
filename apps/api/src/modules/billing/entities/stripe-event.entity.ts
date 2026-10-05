import { StripeEventStatus } from '@mirsonix/shared';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { EnumColumn } from '../../../database/columns';

/** Inbox of received webhooks. The Stripe event id is the primary key, which makes handling idempotent. */
@Entity('stripe_events')
export class StripeEvent {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Index()
  @EnumColumn('stripe_event_status', StripeEventStatus.values, { default: 'RECEIVED' })
  status: StripeEventStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  receivedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
