import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@mirsonix/shared';
import { z } from 'zod';
import { AppConfig } from '../../../config/app-config.module';
import type { AuthenticatedUser } from '../auth.types';

const payloadSchema = z.object({ sub: z.uuid(), role: UserRole.schema });

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  get ttlSeconds(): number {
    return this.config.get('JWT_ACCESS_TTL_SECONDS');
  }

  sign(user: AuthenticatedUser): Promise<string> {
    return this.jwt.signAsync({ role: user.role }, { subject: user.id, expiresIn: this.ttlSeconds });
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = payloadSchema.parse(await this.jwt.verifyAsync(token));
      return { id: payload.sub, role: payload.role };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
