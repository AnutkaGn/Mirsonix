import { UserRole } from '@mirsonix/shared';
import { Column, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EnumColumn, Timestamps } from '../../../database/columns';

@Entity('users')
export class User extends Timestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'citext', unique: true })
  email: string;

  /** Null for OAuth-only accounts. Never selected by default; auth code opts in explicitly. */
  @Column({ type: 'text', nullable: true, select: false })
  passwordHash: string | null;

  @EnumColumn('user_role', UserRole.values, { default: 'USER' })
  role: UserRole;

  @Column({ type: 'varchar', length: 120, nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  locale: string;

  @Column({ type: 'varchar', length: 64, unique: true, nullable: true })
  stripeCustomerId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
