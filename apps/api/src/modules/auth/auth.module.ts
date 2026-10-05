import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../../config/app-config.module';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthPort } from './google/google-oauth.port';
import { GoogleOAuthService } from './google/google-oauth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PasswordService } from './password.service';
import { AccessTokenService } from './tokens/access-token.service';
import { RefreshTokensRepository } from './tokens/refresh-tokens.repository';
import { RefreshTokensService } from './tokens/refresh-tokens.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256', issuer: 'mirsonix', audience: 'mirsonix-web' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'mirsonix', audience: 'mirsonix-web' },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ ttl: 60_000, limit: 60 }],
        skipIf: () => config.get('NODE_ENV') === 'test',
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    AccessTokenService,
    RefreshTokensRepository,
    RefreshTokensService,
    { provide: GoogleOAuthPort, useClass: GoogleOAuthService },
    // Order matters: authenticate first, then authorise by role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AccessTokenService],
})
export class AuthModule {}
