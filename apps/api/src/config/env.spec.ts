import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

const valid = {
  WEB_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults and coerces numbers from strings', () => {
    const env = validateEnv({ ...valid, API_PORT: '5000' });

    expect(env).toMatchObject({ API_PORT: 5000, NODE_ENV: 'development', BCRYPT_COST: 12, REFRESH_REUSE_GRACE_SECONDS: 10 });
  });

  it('treats empty optional credentials as unset', () => {
    expect(validateEnv({ ...valid, GOOGLE_CLIENT_ID: '' }).GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('lists every invalid variable in one error', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'short' })).toThrow(/WEB_ORIGIN[\s\S]*DATABASE_URL[\s\S]*JWT_ACCESS_SECRET/);
  });

  it('rejects a signing secret shorter than 32 characters', () => {
    expect(() => validateEnv({ ...valid, JWT_ACCESS_SECRET: 'a'.repeat(31) })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects the example placeholder secret in production only', () => {
    const placeholder = { ...valid, JWT_ACCESS_SECRET: 'change-me-access-min-32-chars-long-xxxx' };

    expect(() => validateEnv({ ...placeholder, NODE_ENV: 'production' })).toThrow(/placeholder/);
    expect(validateEnv({ ...placeholder, NODE_ENV: 'development' }).JWT_ACCESS_SECRET).toBe(placeholder.JWT_ACCESS_SECRET);
  });
});
