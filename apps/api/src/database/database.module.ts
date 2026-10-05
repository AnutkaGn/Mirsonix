import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../config/app-config.module';
import { buildDataSourceOptions } from './options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => buildDataSourceOptions(config.get('DATABASE_URL')),
    }),
  ],
})
export class DatabaseModule {}
