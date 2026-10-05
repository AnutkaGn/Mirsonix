import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { healthResponseSchema } from '@mirsonix/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.WEB_ORIGIN = 'http://localhost:5173';
    const { createTestDataSource, testDatabaseUrl } = await import('./helpers/test-db');
    await (await createTestDataSource()).destroy();
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a body matching the shared schema', async () => {
    await app.listen(0);
    const res = await fetch(`${await app.getUrl()}/health`);
    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(await res.json());
    expect(body).toMatchObject({ status: 'ok', database: 'up' });
  });
});
