import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startCatalogApp, type Actor, type CatalogApp } from './helpers/catalog-fixture';
import { DAY_MS, HOUR_MS } from './helpers/stripe-fixtures';

let t: CatalogApp;
let stranger: Actor;

beforeAll(async () => {
  t = await startCatalogApp();
  stranger = await t.signIn('USER');
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

const stream = (actor: Actor, trackId: string) => t.as(actor).post(`/stream/tracks/${trackId}/url`);
const library = (actor: Actor) => t.as(actor).get('/library');
const audioKeyOf = async (trackId: string): Promise<string> =>
  (await t.ds.query(`SELECT m.s3_key FROM tracks t JOIN media_assets m ON m.id = t.audio_asset_id WHERE t.id = $1`, [trackId]))[0].s3_key;

/** Manual grants go straight into the table: the admin endpoint has its own spec. */
async function grant(actor: Actor, target: { kind: 'TRACK' | 'PROGRAM'; id: string }, options: { expiresAt?: Date; revokedAt?: Date } = {}) {
  await t.ds.query(
    `INSERT INTO access_grants (user_id, track_id, program_id, source, expires_at, revoked_at, granted_by_id) VALUES ($1, $2, $3, 'ADMIN', $4, $5, $6)`,
    [actor.id, target.kind === 'TRACK' ? target.id : null, target.kind === 'PROGRAM' ? target.id : null, options.expiresAt ?? null, options.revokedAt ?? null, t.admin.id],
  );
}

describe('POST /stream/tracks/:id/url', () => {
  it('needs a login', async () => {
    const track = await t.track({}, { publish: true });

    expect((await t.call(`/stream/tracks/${track.id}/url`, { method: 'POST', body: {} })).status).toBe(401);
  });

  it('refuses a listener who has not bought the track', async () => {
    const track = await t.track({}, { publish: true });

    const res = await stream(t.listener, track.id);

    expect(res.status).toBe(403);
    expect(res.json.message).toBe('You do not have access to this track');
  });

  it('answers a missing track exactly like a track the listener cannot access, so existence does not leak', async () => {
    const real = await t.track({}, { publish: true });

    const missing = await stream(t.listener, randomUUID());
    const forbidden = await stream(t.listener, real.id);

    expect(missing.status).toBe(forbidden.status);
    expect(missing.json.message).toBe(forbidden.json.message);
  });

  it('rejects a malformed id', async () => {
    expect((await stream(t.listener, 'not-a-uuid')).status).toBe(400);
  });

  it('hands out a short-lived signed link to that track\'s own audio', async () => {
    const track = await t.track({}, { publish: true });
    await t.subscribe(t.listener, { kind: 'TRACK', id: track.id });

    const res = await stream(t.listener, track.id);

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ url: `https://fake-s3.test/${await audioKeyOf(track.id)}?signed=1&ttl=600`, expiresIn: 600 });
  });

  describe('subscription status', () => {
    it.each(['ACTIVE', 'TRIALING'])('allows a %s subscription', async (status) => {
      const track = await t.track({}, { publish: true });
      await t.subscribe(t.listener, { kind: 'TRACK', id: track.id }, { status });

      expect((await stream(t.listener, track.id)).status).toBe(200);
    });

    it.each(['PAST_DUE', 'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'CANCELED', 'PAUSED'])(
      'blocks a %s subscription at once',
      async (status) => {
        const track = await t.track({}, { publish: true });
        await t.subscribe(t.listener, { kind: 'TRACK', id: track.id }, { status });

        expect((await stream(t.listener, track.id)).status).toBe(403);
      },
    );

    it('keeps playing until the period ends when the subscription is set to cancel', async () => {
      const track = await t.track({}, { publish: true });
      await t.subscribe(t.listener, { kind: 'TRACK', id: track.id }, { cancelAtPeriodEnd: true, periodEnd: new Date(Date.now() + 5 * DAY_MS) });

      expect((await stream(t.listener, track.id)).status).toBe(200);
    });
  });

  describe('paid period', () => {
    const withPeriodEnd = async (periodEnd: Date | null) => {
      const track = await t.track({}, { publish: true });
      await t.subscribe(t.listener, { kind: 'TRACK', id: track.id }, { periodEnd });
      return track;
    };

    it('allows a period that has not ended, and one with no end date', async () => {
      expect((await stream(t.listener, (await withPeriodEnd(new Date(Date.now() + HOUR_MS))).id)).status).toBe(200);
      expect((await stream(t.listener, (await withPeriodEnd(null)).id)).status).toBe(200);
    });

    it('forgives a renewal webhook that is a little late', async () => {
      const track = await withPeriodEnd(new Date(Date.now() - HOUR_MS));

      expect((await stream(t.listener, track.id)).status).toBe(200);
    });

    it('stops trusting an ACTIVE subscription whose period ended long ago, as when webhooks went missing', async () => {
      const track = await withPeriodEnd(new Date(Date.now() - 7 * HOUR_MS));

      expect((await stream(t.listener, track.id)).status).toBe(403);
    });
  });

  describe('whose subscription it is', () => {
    it('does not let one listener use another listener\'s subscription', async () => {
      const track = await t.track({}, { publish: true });
      await t.subscribe(stranger, { kind: 'TRACK', id: track.id });

      expect((await stream(t.listener, track.id)).status).toBe(403);
      expect((await stream(stranger, track.id)).status).toBe(200);
    });

    it('does not let a subscription to one track open another', async () => {
      const [bought, other] = [await t.track({}, { publish: true }), await t.track({}, { publish: true })];
      await t.subscribe(t.listener, { kind: 'TRACK', id: bought.id });

      expect((await stream(t.listener, bought.id)).status).toBe(200);
      expect((await stream(t.listener, other.id)).status).toBe(403);
    });
  });

  describe('program subscription', () => {
    async function programWith(...tracks: { id: string }[]) {
      const program = await t.program();
      await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: tracks.map((x) => x.id) });
      return program;
    }

    it('opens every track in the program and nothing outside it', async () => {
      const [inside1, inside2, outside] = [await t.track({}, { publish: true }), await t.track({}, { publish: true }), await t.track({}, { publish: true })];
      const program = await programWith(inside1, inside2);
      await t.subscribe(t.listener, { kind: 'PROGRAM', id: program.id });

      expect((await stream(t.listener, inside1.id)).status).toBe(200);
      expect((await stream(t.listener, inside2.id)).status).toBe(200);
      expect((await stream(t.listener, outside.id)).status).toBe(403);
    });

    it('follows the program: a track added later opens, a track removed closes', async () => {
      const [first, second] = [await t.track({}, { publish: true }), await t.track({}, { publish: true })];
      const program = await programWith(first);
      await t.subscribe(t.listener, { kind: 'PROGRAM', id: program.id });
      expect((await stream(t.listener, second.id)).status).toBe(403);

      await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [first.id, second.id] });
      expect((await stream(t.listener, second.id)).status).toBe(200);

      await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [first.id] });
      expect((await stream(t.listener, second.id)).status).toBe(403);
    });

    it('closes the tracks when the program subscription lapses', async () => {
      const track = await t.track({}, { publish: true });
      const program = await programWith(track);
      await t.subscribe(t.listener, { kind: 'PROGRAM', id: program.id }, { status: 'PAST_DUE' });

      expect((await stream(t.listener, track.id)).status).toBe(403);
    });

    it('does not let a track subscription open the rest of the program', async () => {
      const [owned, sibling] = [await t.track({}, { publish: true }), await t.track({}, { publish: true })];
      await programWith(owned, sibling);
      await t.subscribe(t.listener, { kind: 'TRACK', id: owned.id });

      expect((await stream(t.listener, sibling.id)).status).toBe(403);
    });
  });

  describe('manual grants', () => {
    it('allows a track with a grant that does not expire', async () => {
      const track = await t.track({}, { publish: true });
      await grant(t.listener, { kind: 'TRACK', id: track.id });

      expect((await stream(t.listener, track.id)).status).toBe(200);
    });

    it('allows until the expiry and not after', async () => {
      const [live, lapsed] = [await t.track({}, { publish: true }), await t.track({}, { publish: true })];
      await grant(t.listener, { kind: 'TRACK', id: live.id }, { expiresAt: new Date(Date.now() + HOUR_MS) });
      await grant(t.listener, { kind: 'TRACK', id: lapsed.id }, { expiresAt: new Date(Date.now() - 1000) });

      expect((await stream(t.listener, live.id)).status).toBe(200);
      expect((await stream(t.listener, lapsed.id)).status).toBe(403); // grants get no grace: the date is the date
    });

    it('stops at once when revoked', async () => {
      const track = await t.track({}, { publish: true });
      await grant(t.listener, { kind: 'TRACK', id: track.id }, { revokedAt: new Date() });

      expect((await stream(t.listener, track.id)).status).toBe(403);
    });

    it('opens the tracks of a program that was granted', async () => {
      const [inside, outside] = [await t.track({}, { publish: true }), await t.track({}, { publish: true })];
      const program = await t.program();
      await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [inside.id] });
      await grant(t.listener, { kind: 'PROGRAM', id: program.id });

      expect((await stream(t.listener, inside.id)).status).toBe(200);
      expect((await stream(t.listener, outside.id)).status).toBe(403);
    });

    it('is only for the user it was given to', async () => {
      const track = await t.track({}, { publish: true });
      await grant(stranger, { kind: 'TRACK', id: track.id });

      expect((await stream(t.listener, track.id)).status).toBe(403);
    });
  });

  it('keeps playing a track that was archived after the listener subscribed', async () => {
    const track = await t.track({}, { publish: true });
    await t.subscribe(t.listener, { kind: 'TRACK', id: track.id });
    await t.api.post(`/admin/tracks/${track.id}/archive`);

    expect((await stream(t.listener, track.id)).status).toBe(200);
  });
});

describe('GET /library', () => {
  it('is empty for someone who has bought nothing, and needs a login', async () => {
    expect((await library(t.listener)).json).toEqual({ tracks: [], programs: [] });
    expect((await t.call('/library')).status).toBe(401);
  });

  it('lists what the listener holds directly, with the reason and the end of access', async () => {
    const track = await t.track({ title: 'Lung opening' }, { publish: true });
    const periodEnd = new Date(Date.now() + 10 * DAY_MS);
    await t.subscribe(t.listener, { kind: 'TRACK', id: track.id }, { periodEnd, cancelAtPeriodEnd: true });

    const { tracks } = (await library(t.listener)).json;

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      id: track.id,
      title: 'Lung opening',
      access: { source: 'TRACK_SUBSCRIPTION', validUntil: periodEnd.toISOString(), cancelAtPeriodEnd: true },
    });
  });

  it('shows a program, not the tracks inside it, and nothing the listener only browsed', async () => {
    const [inside, browsed] = [await t.track({}, { publish: true }), await t.track({}, { publish: true })];
    const program = await t.program({ title: 'Back recovery' });
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [inside.id] });
    await t.subscribe(t.listener, { kind: 'PROGRAM', id: program.id });

    const res = (await library(t.listener)).json;

    expect(res.tracks).toEqual([]);
    expect(res.programs.map((p: { id: string }) => p.id)).toEqual([program.id]);
    expect(res.programs[0]).toMatchObject({ title: 'Back recovery', trackCount: 1, access: { source: 'PROGRAM_SUBSCRIPTION' } });
    expect(JSON.stringify(res)).not.toContain(browsed.id);
  });

  it('sorts by title', async () => {
    for (const title of ['Zephyr', 'Alpha', 'Moon']) {
      const track = await t.track({ title }, { publish: true });
      await t.subscribe(t.listener, { kind: 'TRACK', id: track.id });
    }

    expect((await library(t.listener)).json.tracks.map((x: { title: string }) => x.title)).toEqual(['Alpha', 'Moon', 'Zephyr']);
  });

  it('leaves out anything whose access has ended', async () => {
    const [lapsed, canceled, live] = [await t.track({}, { publish: true }), await t.track({}, { publish: true }), await t.track({}, { publish: true })];
    await t.subscribe(t.listener, { kind: 'TRACK', id: lapsed.id }, { status: 'PAST_DUE' });
    await t.subscribe(t.listener, { kind: 'TRACK', id: canceled.id }, { status: 'CANCELED' });
    await t.subscribe(t.listener, { kind: 'TRACK', id: live.id });

    expect((await library(t.listener)).json.tracks.map((x: { id: string }) => x.id)).toEqual([live.id]);
  });

  it('keeps showing an item that was archived after purchase', async () => {
    const track = await t.track({}, { publish: true });
    await t.subscribe(t.listener, { kind: 'TRACK', id: track.id });
    await t.api.post(`/admin/tracks/${track.id}/archive`);

    expect((await library(t.listener)).json.tracks.map((x: { id: string }) => x.id)).toEqual([track.id]);
  });

  it('shows one entry when an item is held by subscription and by grant, naming the subscription', async () => {
    const track = await t.track({}, { publish: true });
    await grant(t.listener, { kind: 'TRACK', id: track.id });
    await t.subscribe(t.listener, { kind: 'TRACK', id: track.id });

    const { tracks } = (await library(t.listener)).json;

    expect(tracks).toHaveLength(1);
    expect(tracks[0].access.source).toBe('TRACK_SUBSCRIPTION');
  });

  it('shows a granted item as a grant, with its expiry', async () => {
    const track = await t.track({}, { publish: true });
    const expiresAt = new Date(Date.now() + 3 * DAY_MS);
    await grant(t.listener, { kind: 'TRACK', id: track.id }, { expiresAt });

    expect((await library(t.listener)).json.tracks[0].access).toEqual({ source: 'GRANT', validUntil: expiresAt.toISOString(), cancelAtPeriodEnd: false });
  });

  it('is private to each listener', async () => {
    const track = await t.track({}, { publish: true });
    await t.subscribe(stranger, { kind: 'TRACK', id: track.id });

    expect((await library(t.listener)).json.tracks).toEqual([]);
  });

  it('carries prices, so an item can be renewed or re-bought from the library', async () => {
    const track = await t.track({}, { publish: true });
    await t.price({ kind: 'TRACK', id: track.id }, 'MONTH', 1299);
    await t.subscribe(t.listener, { kind: 'TRACK', id: track.id });

    expect((await library(t.listener)).json.tracks[0].prices).toEqual({ month: { amountMinor: 1299, currency: 'usd' }, year: null });
  });
});

describe('GET /library/programs/:id', () => {
  it('returns the program with its tracks in play order', async () => {
    const [a, b] = [await t.track({ title: 'First' }, { publish: true }), await t.track({ title: 'Second' }, { publish: true })];
    const program = await t.program();
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [b.id, a.id] });
    await t.subscribe(t.listener, { kind: 'PROGRAM', id: program.id });

    const res = await t.as(t.listener).get(`/library/programs/${program.id}`);

    expect(res.status).toBe(200);
    expect(res.json.tracks.map((x: { title: string }) => x.title)).toEqual(['Second', 'First']);
    expect(res.json.access.source).toBe('PROGRAM_SUBSCRIPTION');
  });

  it('is forbidden without access, whatever the program is', async () => {
    const program = await t.program();

    expect((await t.as(t.listener).get(`/library/programs/${program.id}`)).status).toBe(403);
    expect((await t.as(t.listener).get(`/library/programs/${randomUUID()}`)).status).toBe(403);
  });

  it('still opens a program that was archived after purchase', async () => {
    const track = await t.track({}, { publish: true });
    const program = await t.program();
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [track.id] });
    await t.api.post(`/admin/programs/${program.id}/publish`);
    await t.subscribe(t.listener, { kind: 'PROGRAM', id: program.id });
    await t.api.post(`/admin/programs/${program.id}/archive`);

    const res = await t.as(t.listener).get(`/library/programs/${program.id}`);

    expect(res.status).toBe(200);
    expect(res.json.tracks).toHaveLength(1);
  });
});
