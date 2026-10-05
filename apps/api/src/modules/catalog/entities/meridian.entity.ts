import { Polarity } from '@mirsonix/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { EnumColumn } from '../../../database/columns';
import { Element } from './element.entity';

/** The 12 principal meridians plus the Governing/Conception vessels. Reference data, seeded. */
@Entity('meridians')
export class Meridian {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null for the vessels, which sit outside the five-element cycle. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  elementId: string | null;

  @ManyToOne(() => Element, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'element_id' })
  element: Relation<Element> | null;

  /** Standard abbreviation: LU, LI, ST, SP, HT, SI, BL, KI, PC, TE, GB, LR, GV, CV. */
  @Column({ type: 'varchar', length: 4, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @EnumColumn('polarity', Polarity.values)
  polarity: Polarity;
}
