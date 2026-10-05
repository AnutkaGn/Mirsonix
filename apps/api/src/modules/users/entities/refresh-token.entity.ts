import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  /** SHA-256 of the opaque token; the raw token only ever lives in the httpOnly cookie. */
  @Column({ type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  /** All tokens descended from one login share a family, so reuse of a rotated token revokes the lot. */
  @Index()
  @Column({ type: 'uuid' })
  familyId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
