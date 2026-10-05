import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthSession, AuthUser, LoginInput, RegisterInput } from '@mirsonix/shared';
import { QueryFailedError } from 'typeorm';
import type { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { RequestMeta } from './auth.types';
import type { GoogleProfile } from './google/google-oauth.port';
import { PasswordService } from './password.service';
import { AccessTokenService } from './tokens/access-token.service';
import { RefreshTokensService, type IssuedRefreshToken } from './tokens/refresh-tokens.service';

/** A session plus the refresh token the controller must put into the cookie. */
export interface AuthResult {
  session: AuthSession;
  refresh: IssuedRefreshToken;
}

const UNIQUE_VIOLATION = '23505';

export const toAuthUser = (user: User): AuthUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  displayName: user.displayName,
  locale: user.locale,
});

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokensService,
  ) {}

  async register(input: RegisterInput, meta: RequestMeta): Promise<AuthResult> {
    if (await this.users.findByEmail(input.email)) throw new ConflictException('Email is already registered');
    try {
      const user = await this.users.create({
        email: input.email,
        passwordHash: await this.passwords.hash(input.password),
        displayName: input.displayName ?? null,
        role: 'USER',
      });
      return await this.startSession(user, meta);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Email is already registered'); // lost a race
      throw error;
    }
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.users.findByEmailWithPassword(input.email);
    const valid = await this.passwords.verify(input.password, user?.passwordHash);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');

    await this.users.update(user.id, { lastLoginAt: new Date() });
    return this.startSession(user, meta);
  }

  async refresh(presentedToken: string, meta: RequestMeta): Promise<AuthResult> {
    const refresh = await this.refreshTokens.rotate(presentedToken, meta);
    const user = await this.users.findById(refresh.userId);
    if (!user) {
      await this.refreshTokens.revokeAllForUser(refresh.userId); // account deleted since the token was issued
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { session: await this.buildSession(user), refresh };
  }

  logout(presentedToken: string | undefined): Promise<void> {
    return presentedToken ? this.refreshTokens.revokeSession(presentedToken) : Promise.resolve();
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return toAuthUser(user);
  }

  async loginWithGoogle(profile: GoogleProfile, meta: RequestMeta): Promise<AuthResult> {
    if (!profile.emailVerified) throw new ForbiddenException('Google account email is not verified');

    const identity = await this.users.findIdentity('GOOGLE', profile.sub);
    let user: User | null = identity?.user ?? null;
    if (identity && !user) throw new UnauthorizedException('Account no longer exists');

    if (!user) {
      const existing = await this.users.findByEmail(profile.email);
      if (existing) {
        if (!existing.emailVerifiedAt) {
          // The password on an unverified account may have been set by someone who does not own the mailbox
          // (pre-registration takeover). Google has just proven ownership, so drop it and end old sessions.
          await this.users.update(existing.id, { passwordHash: null, emailVerifiedAt: new Date() });
          await this.refreshTokens.revokeAllForUser(existing.id);
        }
        await this.users.linkIdentity(existing.id, 'GOOGLE', profile.sub);
        user = existing;
      } else {
        user = await this.users.createWithIdentity(
          { email: profile.email, passwordHash: null, displayName: profile.name, role: 'USER', emailVerifiedAt: new Date() },
          'GOOGLE',
          profile.sub,
        );
      }
    }

    await this.users.update(user.id, { lastLoginAt: new Date() });
    return this.startSession(user, meta);
  }

  private async startSession(user: User, meta: RequestMeta): Promise<AuthResult> {
    const [session, refresh] = await Promise.all([this.buildSession(user), this.refreshTokens.issue(user.id, meta)]);
    return { session, refresh };
  }

  private async buildSession(user: User): Promise<AuthSession> {
    return {
      accessToken: await this.accessTokens.sign({ id: user.id, role: user.role }),
      expiresIn: this.accessTokens.ttlSeconds,
      user: toAuthUser(user),
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION;
}
