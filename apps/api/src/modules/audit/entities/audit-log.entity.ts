import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('audit_logs')
@Index('idx_audit_logs_entity', ['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  adminId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'admin_id' })
  admin: Relation<User>;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 100 })
  entityType: string;

  @Column({ type: 'varchar', length: 64 })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
