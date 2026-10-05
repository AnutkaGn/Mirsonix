import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth';

const valid = { email: 'gina@example.com', password: 'correct-horse-9' };

describe('registerSchema', () => {
  it('trims and lower-cases the email before validating it', () => {
    expect(registerSchema.parse({ ...valid, email: '  Gina@Example.COM ' }).email).toBe('gina@example.com');
  });

  it('rejects an invalid email', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects an email longer than 254 characters', () => {
    expect(registerSchema.safeParse({ ...valid, email: `${'a'.repeat(250)}@x.dev` }).success).toBe(false);
  });

  it('requires at least 8 characters in the password', () => {
    expect(registerSchema.safeParse({ ...valid, password: '1234567' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(true);
  });

  it('measures the password limit in bytes, because bcrypt ignores everything past 72', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'a'.repeat(72) }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, password: 'a'.repeat(73) }).success).toBe(false);
    // 37 two-byte characters is 74 bytes: short in characters, too long in bytes.
    expect(registerSchema.safeParse({ ...valid, password: 'é'.repeat(37) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: 'é'.repeat(36) }).success).toBe(true);
  });

  it('keeps the display name optional but not blank', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, displayName: '   ' }).success).toBe(false);
    expect(registerSchema.parse({ ...valid, displayName: '  Gina ' }).displayName).toBe('Gina');
  });
});

describe('loginSchema', () => {
  it('does not apply the password policy to an existing account', () => {
    expect(loginSchema.safeParse({ email: valid.email, password: 'x' }).success).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: valid.email, password: '' }).success).toBe(false);
  });

  it('normalises the email like registration does', () => {
    expect(loginSchema.parse({ email: ' GINA@example.com', password: 'x' }).email).toBe('gina@example.com');
  });
});
