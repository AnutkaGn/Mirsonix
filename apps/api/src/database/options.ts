import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { entities } from './entities';
import { SnakeNamingStrategy } from './naming.strategy';

/** Shared by the Nest app, the TypeORM CLI and the tests, so all three see the same schema config. */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities,
    namingStrategy: new SnakeNamingStrategy(),
    // Compiled migrations; the CLI and the app both run from dist. Tests pass their own list.
    migrations: [join(__dirname, 'migrations', '*.js')],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false, // schema changes go through migrations only
    uuidExtension: 'pgcrypto',
  };
}
