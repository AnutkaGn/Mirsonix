import 'reflect-metadata';
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { vi } from 'vitest';
import { testDatabaseUrl } from './test-db';

export interface TestApp {
  app: INestApplication;
  url: string;
  close: () => Promise<void>;
}

/**
 * Boots the real AppModule against the test database. Config is read when the module graph is imported, so
 * modules are reset per call to let a test change env (e.g. the refresh grace window).
 */
export async function createTestApp(
  env: Record<string, string> = {},
  configure?: (builder: ReturnType<typeof Test.createTestingModule>, tokens: { GoogleOAuthPort: Type; StoragePort: Type; PaymentsPort: Type }) => void,
  extraControllers: Type[] = [],
): Promise<TestApp> {
  Object.assign(process.env, {
    WEB_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: testDatabaseUrl,
    JWT_ACCESS_SECRET: 'x'.repeat(32),
    BCRYPT_COST: '4',
    REFRESH_REUSE_GRACE_SECONDS: '0',
    ...env,
  });
  vi.resetModules();
  const { AppModule } = await import('../../src/app.module');
  const builder = Test.createTestingModule({ imports: [AppModule], controllers: extraControllers });
  // Tokens must come from the same module instance as the app, which resetModules just replaced.
  const { GoogleOAuthPort } = await import('../../src/modules/auth/google/google-oauth.port');
  const { StoragePort } = await import('../../src/modules/media/storage.port');
  const { PaymentsPort } = await import('../../src/modules/payments/payments.port');
  configure?.(builder, { GoogleOAuthPort, StoragePort, PaymentsPort });
  // rawBody: Stripe signs the exact bytes it sends, so the webhook needs them untouched.
  const app = (await builder.compile()).createNestApplication({ rawBody: true });
  app.use(cookieParser());
  await app.init();
  await app.listen(0);
  return { app, url: await app.getUrl(), close: () => app.close() };
}
