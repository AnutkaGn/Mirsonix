import 'reflect-metadata';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { entities } from './entities';
import { SnakeNamingStrategy } from './naming.strategy';

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

/** Entry point for the TypeORM CLI (`pnpm db:*`); the Nest app builds its own connection from AppConfig. */
function cliDataSource(): DataSource {
  loadEnv({ path: ['.env', '../../.env'], quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return new DataSource(buildDataSourceOptions(url));
}

export default cliDataSource();
