import { describe, expect, it } from 'vitest';
import { createAccessGrantSchema } from './library';

const id = '00000000-0000-4000-8000-000000000001';

describe('createAccessGrantSchema', () => {
  it('defaults the source to ADMIN and normalises the email', () => {
    const grant = createAccessGrantSchema.parse({ userEmail: '  Gina@Example.COM ', trackId: id });

    expect(grant).toMatchObject({ userEmail: 'gina@example.com', source: 'ADMIN' });
  });

  it('needs exactly one target', () => {
    expect(createAccessGrantSchema.safeParse({ userEmail: 'a@b.dev' }).success).toBe(false);
    expect(createAccessGrantSchema.safeParse({ userEmail: 'a@b.dev', trackId: id, programId: id }).success).toBe(false);
    expect(createAccessGrantSchema.safeParse({ userEmail: 'a@b.dev', programId: id }).success).toBe(true);
  });

  it('accepts an ISO expiry and rejects anything else', () => {
    expect(createAccessGrantSchema.safeParse({ userEmail: 'a@b.dev', trackId: id, expiresAt: '2030-01-01T00:00:00Z' }).success).toBe(true);
    expect(createAccessGrantSchema.safeParse({ userEmail: 'a@b.dev', trackId: id, expiresAt: 'tomorrow' }).success).toBe(false);
  });

  it('only allows the two manual sources', () => {
    expect(createAccessGrantSchema.safeParse({ userEmail: 'a@b.dev', trackId: id, source: 'PROMO' }).success).toBe(true);
    expect(createAccessGrantSchema.safeParse({ userEmail: 'a@b.dev', trackId: id, source: 'STRIPE' }).success).toBe(false);
  });
});
