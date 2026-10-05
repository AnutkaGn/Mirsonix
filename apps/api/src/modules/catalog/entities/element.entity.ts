import { WuXingElement } from '@mirsonix/shared';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EnumColumn } from '../../../database/columns';

/** Wu Xing five elements. Reference data, seeded. */
@Entity('elements')
export class Element {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @EnumColumn('wu_xing_element', WuXingElement.values, { unique: true })
  code: WuXingElement;

  @Column({ type: 'varchar', length: 50 })
  name: string;
}
