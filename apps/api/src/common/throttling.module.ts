import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfig } from '../config/app-config.module';

/** Rate limiting for every module. Routes opt in with `@UseGuards(ThrottlerGuard)` and tune it with `@Throttle`. */
@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ ttl: 60_000, limit: 60 }],
        skipIf: () => config.get('NODE_ENV') === 'test',
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class ThrottlingModule {}
