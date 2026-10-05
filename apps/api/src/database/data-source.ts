import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './options';

/**
 * Entry point for the TypeORM CLI (`pnpm db:*`) and the seed script only. The Nest app builds its own
 * connection from AppConfig (see database.module.ts), so importing options never has side effects.
 */
loadEnv({ path: ['.env', '../../.env'], quiet: true });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export default new DataSource(buildDataSourceOptions(url));
