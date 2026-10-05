import { Controller, Get } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Roles } from '../src/modules/auth/decorators/roles.decorator';
import { GoogleOAuthPort, type GoogleProfile } from '../src/modules/auth/google/google-oauth.port';
import { createHttp } from './helpers/http';
import { createTestApp, type TestApp } from './helpers/test-app';
import { createTestDataSource } from './helpers/test-db';

@Controller('test-admin')
class StubAdminController {
  @Roles('ADMIN')
  @Get()
  ping() {
    return { ok: true };
  }
}

class FakeGoogle extends GoogleOAuthPort {
  profile: GoogleProfile = { sub: 'g-1', email: 'g@test.dev', emailVerified: true, name: 'Gina' };
  isConfigured = () => true;
  getAuthUrl = (state: string) => `https://accounts.example/auth?state=${state}`;
  exchangeCode = async () => this.profile;
}

let ds: DataSource;
let t: TestApp;
const google = new FakeGoogle();

beforeAll(async () => {
  ds = await createTestDataSource();
  t = await createTestApp({}, (b, tokens) => b.overrideProvider(tokens.GoogleOAuthPort).useValue(google), [StubAdminController]);
});
afterAll(async () => {
  await t.close();
  await ds.destroy();
});

const PASSWORD = 'correct-horse-9';
let n = 0;
const freshEmail = () => `user${++n}-${Date.now()}@test.dev`;

const call = createHttp(() => t.url);

const refreshCookie = (cookies: string[]) => cookies.find((c) => c.startsWith('mx_rt='));
const cookieHeader = (cookies: string[]) => refreshCookie(cookies)!.split(';')[0]!;

async function register(email = freshEmail()) {
  const res = await call('/auth/register', { body: { email, password: PASSWORD } });
  return { email, ...res };
}

describe('register', () => {
  it('creates a session, sets an httpOnly refresh cookie and never leaks the hash', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.json.user).toMatchObject({ role: 'USER', locale: 'en' });
    expect(JSON.stringify(res.json)).not.toMatch(/password/i);
    const cookie = refreshCookie(res.cookies)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('accepts an email pasted with stray spaces and capitals, and stores it normalised', async () => {
    const email = freshEmail();
    const res = await call('/auth/register', { body: { email: `  ${email.toUpperCase()} `, password: PASSWORD } });

    expect(res.status).toBe(201);
    expect(res.json.user.email).toBe(email);
  });

  it('rejects a duplicate email regardless of case', async () => {
    const { email } = await register();
    const dup = await call('/auth/register', { body: { email: email.toUpperCase(), password: PASSWORD } });
    expect(dup.status).toBe(409);
  });

  it('validates input with the shared schema', async () => {
    const res = await call('/auth/register', { body: { email: 'not-an-email', password: 'short' } });
    expect(res.status).toBe(400);
    expect(res.json.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'password']);
  });
});

describe('login', () => {
  it('logs in with the right password', async () => {
    const { email } = await register();
    const res = await call('/auth/login', { body: { email: email.toUpperCase(), password: PASSWORD } });
    expect(res.status).toBe(200);
    expect(res.json.accessToken).toBeTruthy();
  });

  it('gives identical errors for a wrong password and an unknown email', async () => {
    const { email } = await register();
    const wrong = await call('/auth/login', { body: { email, password: 'wrong-password-1' } });
    const unknown = await call('/auth/login', { body: { email: freshEmail(), password: PASSWORD } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json.message).toBe(unknown.json.message);
  });
});

describe('access token', () => {
  it('protects /auth/me', async () => {
    const { json } = await register();
    expect((await call('/auth/me')).status).toBe(401);
    expect((await call('/auth/me', { token: 'garbage' })).status).toBe(401);
    const me = await call('/auth/me', { token: json.accessToken });
    expect(me.status).toBe(200);
    expect(me.json.id).toBe(json.user.id);
  });

  it('keeps /health public', async () => {
    expect((await call('/health')).status).toBe(200);
  });
});

describe('refresh rotation', () => {
  it('issues a new token pair and retires the old refresh token', async () => {
    const first = await register();
    const old = cookieHeader(first.cookies);
    const rotated = await call('/auth/refresh', { method: 'POST', cookie: old });
    expect(rotated.status).toBe(200);
    expect(cookieHeader(rotated.cookies)).not.toBe(old);
    expect((await call('/auth/me', { token: rotated.json.accessToken })).status).toBe(200);
  });

  it('revokes the whole family when a retired token is replayed', async () => {
    const first = await register();
    const old = cookieHeader(first.cookies);
    const rotated = await call('/auth/refresh', { method: 'POST', cookie: old });
    const current = cookieHeader(rotated.cookies);

    expect((await call('/auth/refresh', { method: 'POST', cookie: old })).status).toBe(401); // thief replays
    expect((await call('/auth/refresh', { method: 'POST', cookie: current })).status).toBe(401); // victim kicked too
  });

  it('rejects a missing cookie', async () => {
    expect((await call('/auth/refresh', { method: 'POST' })).status).toBe(401);
  });

  it('expires the cookie when the presented token is unknown', async () => {
    const res = await call('/auth/refresh', { method: 'POST', cookie: 'mx_rt=garbage' });

    expect(res.status).toBe(401);
    expect(refreshCookie(res.cookies)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('logout ends the session', async () => {
    const first = await register();
    const cookie = cookieHeader(first.cookies);
    const out = await call('/auth/logout', { method: 'POST', cookie });
    expect(out.status).toBe(204);
    expect((await call('/auth/refresh', { method: 'POST', cookie })).status).toBe(401);
  });
});

describe('roles', () => {
  it('lets ADMIN through and keeps USER out', async () => {
    const { email, json } = await register();
    expect((await call('/test-admin', { token: json.accessToken })).status).toBe(403);
    expect((await call('/test-admin')).status).toBe(401);

    await ds.query(`UPDATE users SET role = 'ADMIN' WHERE email = $1`, [email]);
    const login = await call('/auth/login', { body: { email, password: PASSWORD } });
    expect((await call('/test-admin', { token: login.json.accessToken })).status).toBe(200);
  });
});

describe('Google sign-in', () => {
  async function googleCallback(overrides: { state?: string } = {}) {
    const start = await call('/auth/google');
    expect(start.status).toBe(302);
    const stateCookie = start.cookies.find((c) => c.startsWith('mx_oauth_state='))!.split(';')[0]!;
    const state = stateCookie.split('=')[1]!;
    return call(`/auth/google/callback?code=abc&state=${overrides.state ?? state}`, { cookie: stateCookie });
  }

  it('creates a verified account and starts a session', async () => {
    google.profile = { sub: 'g-new', email: freshEmail(), emailVerified: true, name: 'New Gina' };
    const res = await googleCallback();
    expect(res.status).toBe(302);
    expect(res.location).toBe('http://localhost:5173/auth/callback');
    const refreshed = await call('/auth/refresh', { method: 'POST', cookie: cookieHeader(res.cookies) });
    expect(refreshed.json.user).toMatchObject({ email: google.profile.email, displayName: 'New Gina' });
  });

  it('signs the same Google user in again without duplicating the account', async () => {
    google.profile = { sub: 'g-repeat', email: freshEmail(), emailVerified: true, name: null };
    await googleCallback();
    await googleCallback();
    const [{ count }] = await ds.query(`SELECT count(*)::int AS count FROM users WHERE email = $1`, [google.profile.email]);
    expect(count).toBe(1);
  });

  it('rejects a mismatched state (CSRF)', async () => {
    const res = await googleCallback({ state: 'forged' });
    expect(res.location).toBe('http://localhost:5173/login?error=google_denied');
    expect(refreshCookie(res.cookies)).toBeUndefined();
  });

  it('rejects an unverified Google email', async () => {
    google.profile = { sub: 'g-unverified', email: freshEmail(), emailVerified: false, name: null };
    const res = await googleCallback();
    expect(res.location).toBe('http://localhost:5173/login?error=google_failed');
  });

  it('defuses pre-registration takeover: unverified local password is wiped on Google sign-in', async () => {
    const victim = freshEmail();
    const attacker = await register(victim); // attacker registers the victim's address with a password they know
    const attackerCookie = cookieHeader(attacker.cookies);

    google.profile = { sub: 'g-victim', email: victim, emailVerified: true, name: 'Victim' };
    const res = await googleCallback(); // the real owner signs in with Google
    expect(res.location).toBe('http://localhost:5173/auth/callback');

    expect((await call('/auth/login', { body: { email: victim, password: PASSWORD } })).status).toBe(401);
    expect((await call('/auth/refresh', { method: 'POST', cookie: attackerCookie })).status).toBe(401);
  });
});

describe('refresh grace window', () => {
  it('rejects a just-rotated token without killing the new one', async () => {
    const graceApp = await createTestApp({ REFRESH_REUSE_GRACE_SECONDS: '30' });
    try {
      const post = (path: string, body: unknown, cookie?: string) =>
        fetch(`${graceApp.url}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
          body: JSON.stringify(body),
        });
      const reg = await post('/auth/register', { email: freshEmail(), password: PASSWORD });
      const old = cookieHeader(reg.headers.getSetCookie());
      const rotated = await post('/auth/refresh', {}, old);
      const current = cookieHeader(rotated.headers.getSetCookie());

      expect((await post('/auth/refresh', {}, old)).status).toBe(401); // parallel-tab race loser
      expect((await post('/auth/refresh', {}, current)).status).toBe(200); // winner's token still works
    } finally {
      await graceApp.close();
    }
  });
});
