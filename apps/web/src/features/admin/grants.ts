import type { AccessGrant } from '@mirsonix/shared';

export type GrantState = 'revoked' | 'expired' | 'active';

/** Mirrors the server's rule, so the list can say why a grant no longer works. */
export function grantState(
  grant: Pick<AccessGrant, 'revokedAt' | 'expiresAt'>,
  now: Date,
): GrantState {
  if (grant.revokedAt) return 'revoked';
  if (grant.expiresAt && new Date(grant.expiresAt) <= now) return 'expired';
  return 'active';
}
