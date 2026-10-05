import { Column, CreateDateColumn, UpdateDateColumn, type ColumnOptions } from 'typeorm';

/** Postgres native enum column fed from the shared enum tuple, so DB and API cannot drift. */
export function EnumColumn<T extends string>(
  enumName: string,
  values: readonly T[],
  options: Omit<ColumnOptions, 'type' | 'enum' | 'enumName'> = {},
): PropertyDecorator {
  return Column({ ...options, type: 'enum', enum: [...values], enumName });
}

export abstract class Timestamps {
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
