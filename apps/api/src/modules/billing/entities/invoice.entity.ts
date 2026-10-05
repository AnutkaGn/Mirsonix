import { InvoiceStatus } from '@mirsonix/shared';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { EnumColumn } from '../../../database/columns';
import { User } from '../../users/entities/user.entity';
import { Subscription } from './subscription.entity';

/** Source of truth for revenue statistics. Mirrors Stripe invoices; refunds are tracked as a running amount. */
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  subscriptionId: string | null;

  @ManyToOne(() => Subscription, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'subscription_id' })
  subscription: Relation<Subscription> | null;

  @Column({ type: 'varchar', length: 64, unique: true })
  stripeInvoiceId: string;

  @EnumColumn('invoice_status', InvoiceStatus.values)
  status: InvoiceStatus;

  @Column({ type: 'int', default: 0 })
  amountPaidMinor: number;

  @Column({ type: 'int', default: 0 })
  amountRefundedMinor: number;

  @Column({ type: 'varchar', length: 3, default: 'usd' })
  currency: string;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
