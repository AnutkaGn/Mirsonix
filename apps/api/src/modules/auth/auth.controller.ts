import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { REFRESH_COOKIE_NAME } from '@mirsonix/shared';
import type { Request, Response } from 'express';
import { ZodSerializerDto } from 'nestjs-zod';
import { AppConfig } from '../../config/app-config.module';
import { AuthSessionDto, AuthUserDto, LoginDto, RegisterDto } from './auth.dto';
import { AuthService, type AuthResult } from './auth.service';
import type { AuthenticatedUser, RequestMeta } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { GoogleOAuthPort } from './google/google-oauth.port';
import { clearRefreshCookie, setRefreshCookie } from './refresh-cookie';

const OAUTH_STATE_COOKIE = 'mx_oauth_state';
const OAUTH_STATE_PATH = '/auth/google';

const meta = (req: Request): RequestMeta => ({
  userAgent: req.headers['user-agent'] ?? null,
  ip: req.ip ?? null,
});

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleOAuthPort,
    private readonly config: AppConfig,
  ) {}

  private get secureCookies(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  private respond(res: Response, { session, refresh }: AuthResult) {
    setRefreshCookie(res, refresh.token, refresh.expiresAt, this.secureCookies);
    return session;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ZodSerializerDto(AuthSessionDto)
  async register(@Body() body: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.register(body, meta(req)));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ZodSerializerDto(AuthSessionDto)
  async login(@Body() body: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.login(body, meta(req)));
  }

  /** Exchanges the refresh cookie for a new access token (and rotates the cookie). */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ZodSerializerDto(AuthSessionDto)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE_NAME];
    if (!presented) throw new UnauthorizedException('Missing refresh token');
    try {
      return this.respond(res, await this.auth.refresh(presented, meta(req)));
    } catch (error) {
      // Drop the cookie only when the token is genuinely bad. A transient failure (database down) must not log the user out.
      if (error instanceof UnauthorizedException) clearRefreshCookie(res, this.secureCookies);
      throw error;
    }
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout((req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE_NAME]);
    clearRefreshCookie(res, this.secureCookies);
  }

  @Get('me')
  @ZodSerializerDto(AuthUserDto)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Get('google')
  googleStart(@Res() res: Response): void {
    const state = randomBytes(24).toString('base64url');
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: OAUTH_STATE_PATH,
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(this.google.getAuthUrl(state));
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const web = this.config.get('WEB_ORIGIN');
    const expected = (req.cookies as Record<string, string | undefined>)[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_STATE_PATH });

    // Redirect targets are fixed (WEB_ORIGIN) so this endpoint cannot be used as an open redirect.
    if (oauthError || !code || !state || !expected || !safeEqual(state, expected)) {
      return res.redirect(`${web}/login?error=google_denied`);
    }
    try {
      const result = await this.auth.loginWithGoogle(await this.google.exchangeCode(code), meta(req));
      setRefreshCookie(res, result.refresh.token, result.refresh.expiresAt, this.secureCookies);
      return res.redirect(`${web}/auth/callback`);
    } catch {
      return res.redirect(`${web}/login?error=google_failed`);
    }
  }
}

function safeEqual(a: string, b: string): boolean {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
}
