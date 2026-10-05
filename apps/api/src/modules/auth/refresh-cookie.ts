import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '@mirsonix/shared';
import type { CookieOptions, Response } from 'express';

const options = (secure: boolean): CookieOptions => ({
  httpOnly: true,
  secure,
  sameSite: 'lax',
  path: REFRESH_COOKIE_PATH,
});

export function setRefreshCookie(res: Response, token: string, expires: Date, secure: boolean): void {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...options(secure), expires });
}

export function clearRefreshCookie(res: Response, secure: boolean): void {
  res.clearCookie(REFRESH_COOKIE_NAME, options(secure));
}
