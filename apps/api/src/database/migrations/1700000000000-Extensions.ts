import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Extensions1700000000000 implements MigrationInterface {
  name = 'Extensions1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"'); // gen_random_uuid()
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "citext"'); // case-insensitive emails
  }

  public async down(): Promise<void> {
    // Extensions are left in place: other objects in the database may depend on them.
  }
}
