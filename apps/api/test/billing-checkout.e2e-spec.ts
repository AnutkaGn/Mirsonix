import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startCatalogApp, type CatalogApp } from './helpers/catalog-fixture';

let t: CatalogApp;

beforeAll(async () => {
  t = await startCatalogApp();
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

const checkout = (body: unknown) => t.asUser.post('/billing/checkout', body);

/** A published track on sale monthly (and optionally yearly). */
async function trackOnSale(options: { yearly?: boolean } = {}) {
  const track = await t.track({}, { publish: true });
  const month = await t.price({ kind: 'TRACK', id: track.id }, 'MONTH', 999);
  const year = options.yearly ? await t.price({ kind: 'TRACK', id: track.id }, 'YEAR', 9900) : null;
  return { track, month, year };
}

describe('POST /billing/checkout', () => {
  it('opens a Stripe checkout for the price on sale, for the logged-in user', async () => {
    const { track, month } = await trackOnSale();

    const res = await checkout({ trackId: track.id, interval: 'MONTH' });

    expect(res.status).toBe(200);
    expect(res.json.url).toMatch(/^https:\/\/checkout\.stripe\.test\/session\//);
    expect(t.payments.checkouts).toHaveLength(1);
    expect(t.payments.checkouts[0]).toMatchObject({
      priceId: month.stripePriceId,
      userId: t.listener.id,
      successUrl: 'http://localhost:5173/library?checkout=success',
      cancelUrl: 'http://localhost:5173/?checkout=cancelled',
      metadata: { userId: t.listener.id, targetKind: 'TRACK', targetId: track.id },
    });
  });

  it('creates the Stripe customer on the first checkout, keeps it, and reuses it afterwards', async () => {
    const [first, second] = [await trackOnSale(), await trackOnSale()];

    await checkout({ trackId: first.track.id, interval: 'MONTH' });
    await checkout({ trackId: second.track.id, interval: 'MONTH' });

    expect(t.payments.customers).toHaveLength(1);
    expect(t.payments.customers[0]).toMatchObject({ userId: t.listener.id });
    const [{ stripe_customer_id }] = await t.ds.query(`SELECT stripe_customer_id FROM users WHERE id = $1`, [t.listener.id]);
    expect(stripe_customer_id).toMatch(/^cus_fake_/);
    expect(t.payments.checkouts.map((c) => c.customerId)).toEqual([stripe_customer_id, stripe_customer_id]);
  });

  it('picks the price of the interval that was asked for', async () => {
    const { track, month, year } = await trackOnSale({ yearly: true });

    await checkout({ trackId: track.id, interval: 'YEAR' });
    await checkout({ trackId: track.id, interval: 'MONTH' });

    expect(t.payments.checkouts.map((c) => c.priceId)).toEqual([year!.stripePriceId, month.stripePriceId]);
  });

  it('never takes the price from the client', async () => {
    const { track, month } = await trackOnSale();

    await checkout({ trackId: track.id, interval: 'MONTH', priceId: 'price_chosen_by_attacker', amountMinor: 1 });

    expect(t.payments.checkouts[0]!.priceId).toBe(month.stripePriceId);
  });

  it('sells a program', async () => {
    const track = await t.track({}, { publish: true });
    const program = await t.program();
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [track.id] });
    await t.api.post(`/admin/programs/${program.id}/publish`);
    const price = await t.price({ kind: 'PROGRAM', id: program.id }, 'YEAR', 19900);

    const res = await checkout({ programId: program.id, interval: 'YEAR' });

    expect(res.status).toBe(200);
    expect(t.payments.checkouts[0]).toMatchObject({ priceId: price.stripePriceId, metadata: { targetKind: 'PROGRAM', targetId: program.id } });
  });

  it('refuses an interval the item is not sold for', async () => {
    const { track } = await trackOnSale(); // monthly only

    const res = await checkout({ trackId: track.id, interval: 'YEAR' });

    expect(res.status).toBe(422);
    expect(t.payments.checkouts).toEqual([]);
  });

  it('refuses an item that has no price at all', async () => {
    const track = await t.track({}, { publish: true });

    expect((await checkout({ trackId: track.id, interval: 'MONTH' })).status).toBe(422);
  });

  it('refuses a track that is a draft or archived, as if it did not exist', async () => {
    const draft = await t.track();
    await t.price({ kind: 'TRACK', id: draft.id });
    const archived = await t.track({}, { publish: true });
    await t.price({ kind: 'TRACK', id: archived.id });
    await t.api.post(`/admin/tracks/${archived.id}/archive`);

    expect((await checkout({ trackId: draft.id, interval: 'MONTH' })).status).toBe(404);
    expect((await checkout({ trackId: archived.id, interval: 'MONTH' })).status).toBe(404);
    expect((await checkout({ trackId: randomUUID(), interval: 'MONTH' })).status).toBe(404);
    expect(t.payments.checkouts).toEqual([]);
  });

  describe('subscribing twice', () => {
    it.each(['ACTIVE', 'TRIALING', 'PAST_DUE', 'INCOMPLETE'])('refuses an item the user already subscribes to (%s)', async (status) => {
      const { track } = await trackOnSale();
      await t.subscribe(t.listener, { kind: 'TRACK', id: track.id }, { status });

      expect((await checkout({ trackId: track.id, interval: 'MONTH' })).status).toBe(409);
      expect(t.payments.checkouts).toEqual([]);
    });

    it.each(['CANCELED', 'INCOMPLETE_EXPIRED'])('allows subscribing again after the old subscription ended (%s)', async (status) => {
      const { track } = await trackOnSale();
      await t.subscribe(t.listener, { kind: 'TRACK', id: track.id }, { status });

      expect((await checkout({ trackId: track.id, interval: 'MONTH' })).status).toBe(200);
    });

    it('lets someone else subscribe to what this user holds', async () => {
      const { track } = await trackOnSale();
      const other = await t.signIn('USER');
      await t.subscribe(other, { kind: 'TRACK', id: track.id });

      expect((await checkout({ trackId: track.id, interval: 'MONTH' })).status).toBe(200);
    });

    it('allows a program to be bought by someone who already holds one of its tracks', async () => {
      const track = await t.track({}, { publish: true });
      const program = await t.program();
      await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [track.id] });
      await t.api.post(`/admin/programs/${program.id}/publish`);
      await t.price({ kind: 'PROGRAM', id: program.id });
      await t.subscribe(t.listener, { kind: 'TRACK', id: track.id });

      expect((await checkout({ programId: program.id, interval: 'MONTH' })).status).toBe(200);
    });
  });

  it.each([
    ['both a track and a program', () => ({ trackId: randomUUID(), programId: randomUUID(), interval: 'MONTH' })],
    ['neither', () => ({ interval: 'MONTH' })],
    ['an unknown interval', () => ({ trackId: randomUUID(), interval: 'WEEK' })],
    ['a malformed id', () => ({ trackId: 'nope', interval: 'MONTH' })],
  ])('rejects a request with %s', async (_label, body) => {
    expect((await checkout(body())).status).toBe(400);
  });

  it('needs a login', async () => {
    expect((await t.call('/billing/checkout', { body: { trackId: randomUUID(), interval: 'MONTH' } })).status).toBe(401);
  });

  it('is unavailable while payments are not configured', async () => {
    const { track } = await trackOnSale();
    t.payments.configured = false;

    expect((await checkout({ trackId: track.id, interval: 'MONTH' })).status).toBe(503);
  });
});

describe('POST /billing/portal', () => {
  it('opens the customer portal and sends the user back to their library', async () => {
    const customerId = await t.customerOf(t.listener);

    const res = await t.asUser.post('/billing/portal');

    expect(res.status).toBe(200);
    expect(res.json.url).toMatch(/^https:\/\/portal\.stripe\.test\/session\//);
    expect(t.payments.portals).toEqual([{ customerId, returnUrl: 'http://localhost:5173/library' }]);
  });

  it('is a 404 for someone who has never paid, since there is no billing account to manage', async () => {
    const newcomer = await t.signIn('USER');

    expect((await t.as(newcomer).post('/billing/portal')).status).toBe(404);
  });

  it('is unavailable while payments are not configured, and needs a login', async () => {
    await t.customerOf(t.listener);
    t.payments.configured = false;

    expect((await t.asUser.post('/billing/portal')).status).toBe(503);
    expect((await t.call('/billing/portal', { method: 'POST', body: {} })).status).toBe(401);
  });
});
