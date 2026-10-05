import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Target issue a track addresses (back pain, chronic pain, ...). Reference data, seeded and admin-editable. */
@Entity('issues')
export class Issue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;
}
