import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startCatalogApp, type Actor, type CatalogApp } from './helpers/catalog-fixture';
import { DAY_MS } from './helpers/stripe-fixtures';

let t: CatalogApp;
let guest: Actor & { email: string };

beforeAll(async () => {
  t = await startCatalogApp();
  const actor = await t.signIn('USER');
  const [{ email }] = await t.ds.query(`SELECT email FROM users WHERE id = $1`, [actor.id]);
  guest = { ...actor, email };
});
afterAll(() => t.stop());
beforeEach(async () => {
  await t.reset();
  await t.ds.query(`TRUNCATE access_grants`);
});

const canStream = async (trackId: string) => (await t.as(guest).post(`/stream/tracks/${trackId}/url`)).status === 200;
const grantTrack = (trackId: string, extra: Record<string, unknown> = {}) =>
  t.api.post('/admin/access-grants', { userEmail: guest.email, trackId, ...extra });

describe('POST /admin/access-grants', () => {
  it('gives a listener a track without a payment, attributed to the admin', async () => {
    const track = await t.track({}, { publish: true });
    expect(await canStream(track.id)).toBe(false);

    const res = await grantTrack(track.id, { source: 'PROMO', note: '  launch giveaway ' });

    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      userId: guest.id,
      userEmail: guest.email,
      trackId: track.id,
      programId: null,
      source: 'PROMO',
      expiresAt: null,
      revokedAt: null,
      note: 'launch giveaway',
    });
    expect(await canStream(track.id)).toBe(true);
    const [row] = await t.ds.query(`SELECT granted_by_id FROM access_grants WHERE id = $1`, [res.json.id]);
    expect(row.granted_by_id).toBe(t.admin.id);
  });

  it('defaults the source to ADMIN and finds the user whatever the case of the email', async () => {
    const track = await t.track({}, { publish: true });

    const res = await grantTrack(track.id, { userEmail: `  ${guest.email.toUpperCase()} ` });

    expect(res.status).toBe(201);
    expect(res.json.source).toBe('ADMIN');
  });

  it('opens the tracks of a granted program', async () => {
    const [inside, outside] = [await t.track({}, { publish: true }), await t.track({}, { publish: true })];
    const program = await t.program();
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [inside.id] });

    const res = await t.api.post('/admin/access-grants', { userEmail: guest.email, programId: program.id });

    expect(res.status).toBe(201);
    expect(await canStream(inside.id)).toBe(true);
    expect(await canStream(outside.id)).toBe(false);
  });

  it('can be given an end date, after which it stops working', async () => {
    const track = await t.track({}, { publish: true });
    const res = await grantTrack(track.id, { expiresAt: new Date(Date.now() + 7 * DAY_MS).toISOString() });
    expect(await canStream(track.id)).toBe(true);

    await t.ds.query(`UPDATE access_grants SET expires_at = now() - interval '1 minute' WHERE id = $1`, [res.json.id]);

    expect(await canStream(track.id)).toBe(false);
  });

  it('writes an audit entry', async () => {
    const track = await t.track({}, { publish: true });
    const res = await grantTrack(track.id);

    const logs = await t.ds.query(`SELECT admin_id, metadata FROM audit_logs WHERE action = 'access-grant.create' AND entity_id = $1`, [res.json.id]);
    expect(logs).toEqual([{ admin_id: t.admin.id, metadata: { userId: guest.id, trackId: track.id, programId: null, source: 'ADMIN' } }]);
  });

  describe('refuses', () => {
    it('an email that belongs to nobody', async () => {
      const track = await t.track({}, { publish: true });

      expect((await grantTrack(track.id, { userEmail: 'nobody@example.com' })).status).toBe(404);
    });

    it('a track or program that does not exist', async () => {
      expect((await grantTrack(randomUUID())).status).toBe(404);
      expect((await t.api.post('/admin/access-grants', { userEmail: guest.email, programId: randomUUID() })).status).toBe(404);
    });

    it('an end date that has already passed', async () => {
      const track = await t.track({}, { publish: true });

      expect((await grantTrack(track.id, { expiresAt: new Date(Date.now() - 1000).toISOString() })).status).toBe(422);
    });

    it.each([
      ['no target', (id: string) => ({ userEmail: guest.email, note: id })],
      ['two targets', (id: string) => ({ userEmail: guest.email, trackId: id, programId: id })],
      ['a malformed email', (id: string) => ({ userEmail: 'nope', trackId: id })],
      ['an end date that is not a date', (id: string) => ({ userEmail: guest.email, trackId: id, expiresAt: 'tomorrow' })],
      ['a source that is not manual', (id: string) => ({ userEmail: guest.email, trackId: id, source: 'STRIPE' })],
    ])('a request with %s', async (_label, body) => {
      const res = await t.api.post('/admin/access-grants', body(randomUUID()));

      expect(res.status).toBe(400);
    });
  });
});

describe('POST /admin/access-grants/:id/revoke', () => {
  it('takes the access away at once', async () => {
    const track = await t.track({}, { publish: true });
    const { json: grant } = await grantTrack(track.id);
    expect(await canStream(track.id)).toBe(true);

    const res = await t.api.post(`/admin/access-grants/${grant.id}/revoke`);

    expect(res.status).toBe(200);
    expect(res.json.revokedAt).toBeTruthy();
    expect(await canStream(track.id)).toBe(false);
  });

  it('is harmless to repeat: the first revocation time and a single audit entry remain', async () => {
    const track = await t.track({}, { publish: true });
    const { json: grant } = await grantTrack(track.id);
    const first = await t.api.post(`/admin/access-grants/${grant.id}/revoke`);

    const second = await t.api.post(`/admin/access-grants/${grant.id}/revoke`);

    expect(second.json.revokedAt).toBe(first.json.revokedAt);
    const [{ count }] = await t.ds.query(`SELECT count(*)::int AS count FROM audit_logs WHERE action = 'access-grant.revoke'`);
    expect(count).toBe(1);
  });

  it('leaves a paid subscription to the same track alone', async () => {
    const track = await t.track({}, { publish: true });
    await t.subscribe(guest, { kind: 'TRACK', id: track.id });
    const { json: grant } = await grantTrack(track.id);

    await t.api.post(`/admin/access-grants/${grant.id}/revoke`);

    expect(await canStream(track.id)).toBe(true);
  });

  it('is a 404 for an unknown grant and a 400 for a malformed id', async () => {
    expect((await t.api.post(`/admin/access-grants/${randomUUID()}/revoke`)).status).toBe(404);
    expect((await t.api.post('/admin/access-grants/nope/revoke')).status).toBe(400);
  });
});

describe('GET /admin/access-grants', () => {
  it('lists grants newest first with the email of whoever holds them, and filters by user', async () => {
    const [a, b] = [await t.track({}, { publish: true }), await t.track({}, { publish: true })];
    const other = await t.signIn('USER');
    const [{ email: otherEmail }] = await t.ds.query(`SELECT email FROM users WHERE id = $1`, [other.id]);
    await grantTrack(a.id);
    await t.api.post('/admin/access-grants', { userEmail: otherEmail, trackId: b.id });

    const all = await t.api.get('/admin/access-grants');
    expect(all.json.meta).toMatchObject({ total: 2, page: 1 });
    expect(all.json.items.map((g: { userEmail: string }) => g.userEmail)).toEqual([otherEmail, guest.email]);

    const mine = await t.api.get(`/admin/access-grants?userId=${guest.id}`);
    expect(mine.json.items.map((g: { trackId: string }) => g.trackId)).toEqual([a.id]);
  });

  it('pages', async () => {
    for (let i = 0; i < 3; i++) await grantTrack((await t.track({}, { publish: true })).id);

    const page = await t.api.get('/admin/access-grants?limit=2&page=2');

    expect(page.json.items).toHaveLength(1);
    expect(page.json.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });
});

describe('access control', () => {
  it.each([
    ['GET', '/admin/access-grants'],
    ['POST', '/admin/access-grants'],
    ['POST', `/admin/access-grants/${randomUUID()}/revoke`],
  ])('keeps listeners and anonymous visitors out of %s %s', async (method, path) => {
    const body = method === 'POST' ? {} : undefined;

    expect((await t.call(path, { method, body, token: t.listener.token })).status).toBe(403);
    expect((await t.call(path, { method, body })).status).toBe(401);
  });
});
