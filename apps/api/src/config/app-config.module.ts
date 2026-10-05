import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv, type Env } from './env';

/** Typed accessor so the rest of the app never touches process.env or string keys. */
export class AppConfig extends ConfigService<Env, true> {}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Works whether started from apps/api (turbo/pnpm) or from the repo root.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
  ],
  providers: [{ provide: AppConfig, useExisting: ConfigService }],
  exports: [AppConfig],
})
export class AppConfigModule {}
