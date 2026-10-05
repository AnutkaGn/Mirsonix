import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.module';
import type { RequestMeta } from '../auth.types';
import { RefreshTokensRepository } from './refresh-tokens.repository';

export interface IssuedRefreshToken {
  userId: string;
  /** The raw token. Only ever sent to the client in a cookie; the database stores its hash. */
  token: string;
  expiresAt: Date;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Opaque refresh tokens with rotation. Every login starts a "family"; each refresh retires the presented
 * token and issues a successor in the same family. Presenting a retired token means it was copied, so the
 * whole family is revoked (the legitimate user and the thief both have to log in again).
 */
@Injectable()
export class RefreshTokensService {
  constructor(
    private readonly repository: RefreshTokensRepository,
    private readonly config: AppConfig,
  ) {}

  issue(userId: string, meta: RequestMeta, familyId: string = randomUUID()): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.get('JWT_REFRESH_TTL_DAYS') * 86_400_000);
    return this.repository
      .create({ userId, tokenHash: hash(token), familyId, expiresAt, userAgent: meta.userAgent, ip: meta.ip })
      .then(() => ({ userId, token, expiresAt }));
  }

  async rotate(presented: string, meta: RequestMeta): Promise<IssuedRefreshToken> {
    const stored = await this.repository.findByHash(hash(presented));
    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    const now = new Date();
    if (stored.revokedAt) {
      const graceMs = this.config.get('REFRESH_REUSE_GRACE_SECONDS') * 1000;
      // Inside the grace window this is almost certainly two tabs refreshing at once, not theft.
      if (now.getTime() - stored.revokedAt.getTime() > graceMs) await this.repository.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.expiresAt <= now) throw new UnauthorizedException('Refresh token expired');
    if (!(await this.repository.revokeIfActive(stored.id, now))) {
      throw new UnauthorizedException('Invalid refresh token'); // lost a concurrent rotation race
    }
    return this.issue(stored.userId, meta, stored.familyId);
  }

  /** Logout: ends the session (family) the presented token belongs to. Unknown tokens are ignored. */
  async revokeSession(presented: string): Promise<void> {
    const stored = await this.repository.findByHash(hash(presented));
    if (stored) await this.repository.revokeFamily(stored.familyId);
  }

  revokeAllForUser(userId: string): Promise<void> {
    return this.repository.revokeAllForUser(userId);
  }
}
