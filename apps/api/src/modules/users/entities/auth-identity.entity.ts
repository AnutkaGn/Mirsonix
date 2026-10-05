import { AuthProvider } from '@mirsonix/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { EnumColumn } from '../../../database/columns';
import { User } from './user.entity';

@Entity('auth_identities')
@Unique(['provider', 'providerUserId'])
export class AuthIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @EnumColumn('auth_provider', AuthProvider.values)
  provider: AuthProvider;

  @Column({ type: 'varchar', length: 255 })
  providerUserId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
