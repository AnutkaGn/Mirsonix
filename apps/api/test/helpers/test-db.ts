import 'reflect-metadata';
import { Client } from 'pg';
import { DataSource, type MigrationInterface } from 'typeorm';
import { buildDataSourceOptions } from '../../src/database/options';

const BASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://mirsonix:mirsonix@localhost:5433/mirsonix_test';

const migrationModules = import.meta.glob('../../src/database/migrations/*.ts', { eager: true }) as Record<
  string,
  Record<string, new () => MigrationInterface>
>;
const migrations = Object.keys(migrationModules)
  .sort()
  .map((file) => Object.values(migrationModules[file]!)[0]!);

export const testDatabaseUrl = BASE_URL;

/** Recreates an empty test database, so tests always run against a fresh schema built by the real migrations. */
export async function createTestDataSource(): Promise<DataSource> {
  const url = new URL(BASE_URL);
  const dbName = url.pathname.slice(1);
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const ds = new DataSource({ ...buildDataSourceOptions(BASE_URL), migrations });
  await ds.initialize();
  await ds.runMigrations();
  return ds;
}
