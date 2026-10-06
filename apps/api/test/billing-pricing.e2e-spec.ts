import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startCatalogApp, type CatalogApp } from './helpers/catalog-fixture';

let t: CatalogApp;

beforeAll(async () => {
  t = await startCatalogApp();
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

const setTrackPrices = (id: string, body: unknown) => t.api.put(`/admin/tracks/${id}/prices`, body);
const activePrices = async (column: 'track_id' | 'program_id', id: string) =>
  t.ds.query(`SELECT interval, amount_minor, currency, stripe_price_id FROM prices WHERE ${column} = $1 AND is_active ORDER BY interval`, [id]);

describe('PUT /admin/tracks/:id/prices', () => {
  it('creates the Stripe product and one price per interval, and puts them on sale', async () => {
    const track = await t.track({ title: 'Lung opening', description: 'Slow breathing.' }, { publish: true });

    const res = await setTrackPrices(track.id, { monthlyAmountMinor: 999, yearlyAmountMinor: 9900 });

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ month: { amountMinor: 999, currency: 'usd' }, year: { amountMinor: 9900, currency: 'usd' } });
    expect(t.payments.products).toEqual([{ name: 'Lung opening', description: 'Slow breathing.' }]);
    expect(t.payments.prices.map((p) => [p.interval, p.amountMinor, p.currency])).toEqual([
      ['MONTH', 999, 'usd'],
      ['YEAR', 9900, 'usd'],
    ]);
    const [{ stripe_product_id }] = await t.ds.query(`SELECT stripe_product_id FROM tracks WHERE id = $1`, [track.id]);
    expect(stripe_product_id).toBe('prod_fake_1');
    expect(await activePrices('track_id', track.id)).toHaveLength(2);
  });

  it('shows the prices to listeners in the catalog', async () => {
    const track = await t.track({}, { publish: true });
    await setTrackPrices(track.id, { monthlyAmountMinor: 1299, yearlyAmountMinor: null });

    const { prices } = (await t.asUser.get(`/catalog/tracks/${track.slug}`)).json;

    expect(prices).toEqual({ month: { amountMinor: 1299, currency: 'usd' }, year: null });
  });

  it('shows the prices to the admin on the track', async () => {
    const track = await t.track();
    await setTrackPrices(track.id, { monthlyAmountMinor: 500, yearlyAmountMinor: 5000 });

    expect((await t.api.get(`/admin/tracks/${track.id}`)).json.prices.year.amountMinor).toBe(5000);
  });

  it('does nothing, and pays Stripe nothing, when the prices are already what was asked', async () => {
    const track = await t.track();
    await setTrackPrices(track.id, { monthlyAmountMinor: 999, yearlyAmountMinor: 9900 });
    const before = { products: t.payments.products.length, prices: t.payments.prices.length, archived: t.payments.archivedPrices.length };

    const again = await setTrackPrices(track.id, { monthlyAmountMinor: 999, yearlyAmountMinor: 9900 });

    expect(again.status).toBe(200);
    expect({ products: t.payments.products.length, prices: t.payments.prices.length, archived: t.payments.archivedPrices.length }).toEqual(before);
  });

  it('replaces a changed price: a new Stripe price goes on sale and the old one is retired, not edited', async () => {
    const track = await t.track();
    await setTrackPrices(track.id, { monthlyAmountMinor: 999, yearlyAmountMinor: 9900 });
    const [{ stripe_price_id: oldMonthly }] = await activePrices('track_id', track.id);

    const res = await setTrackPrices(track.id, { monthlyAmountMinor: 1499, yearlyAmountMinor: 9900 });

    expect(res.json.month.amountMinor).toBe(1499);
    expect(res.json.year.amountMinor).toBe(9900); // the other interval is untouched
    expect(t.payments.archivedPrices).toEqual([oldMonthly]);
    expect(t.payments.products).toHaveLength(1); // the product is reused
    const history = await t.ds.query(`SELECT amount_minor, is_active FROM prices WHERE track_id = $1 AND interval = 'MONTH' ORDER BY amount_minor`, [track.id]);
    expect(history).toEqual([{ amount_minor: 999, is_active: false }, { amount_minor: 1499, is_active: true }]);
  });

  it('takes an interval off sale with null, and can put it back later', async () => {
    const track = await t.track({}, { publish: true });
    await setTrackPrices(track.id, { monthlyAmountMinor: 999, yearlyAmountMinor: 9900 });

    const off = await setTrackPrices(track.id, { monthlyAmountMinor: 999, yearlyAmountMinor: null });
    expect(off.json.year).toBeNull();
    expect(t.payments.archivedPrices).toHaveLength(1);
    expect((await t.asUser.get(`/catalog/tracks/${track.slug}`)).json.prices.year).toBeNull();

    const back = await setTrackPrices(track.id, { monthlyAmountMinor: 999, yearlyAmountMinor: 8800 });
    expect(back.json.year.amountMinor).toBe(8800);
  });

  it('does not create a Stripe product for an item that is never put on sale', async () => {
    const track = await t.track();

    const res = await setTrackPrices(track.id, { monthlyAmountMinor: null, yearlyAmountMinor: null });

    expect(res.json).toEqual({ month: null, year: null });
    expect(t.payments.products).toEqual([]);
  });

  it('keeps the new price even when Stripe fails to archive the old one', async () => {
    const track = await t.track();
    await setTrackPrices(track.id, { monthlyAmountMinor: 999, yearlyAmountMinor: null });
    t.payments.failArchive = true;

    const res = await setTrackPrices(track.id, { monthlyAmountMinor: 1999, yearlyAmountMinor: null });

    expect(res.status).toBe(200);
    expect(res.json.month.amountMinor).toBe(1999);
    expect(await activePrices('track_id', track.id)).toHaveLength(1);
  });

  it('records who changed the price', async () => {
    const track = await t.track();
    await setTrackPrices(track.id, { monthlyAmountMinor: 999, yearlyAmountMinor: null });

    const logs = await t.ds.query(`SELECT admin_id, metadata FROM audit_logs WHERE action = 'track.set-prices' AND entity_id = $1`, [track.id]);
    expect(logs).toEqual([{ admin_id: t.admin.id, metadata: { monthlyAmountMinor: 999, yearlyAmountMinor: null } }]);
  });

  it.each([
    ['below Stripe\'s $0.50 minimum', { monthlyAmountMinor: 49, yearlyAmountMinor: null }],
    ['above the cap', { monthlyAmountMinor: 1_000_001, yearlyAmountMinor: null }],
    ['in fractional cents', { monthlyAmountMinor: 999.5, yearlyAmountMinor: null }],
    ['without stating one of the intervals', { monthlyAmountMinor: 999 }],
    ['as text', { monthlyAmountMinor: '9.99', yearlyAmountMinor: null }],
  ])('rejects a price %s, leaving everything as it was', async (_label, body) => {
    const track = await t.track();

    expect((await setTrackPrices(track.id, body)).status).toBe(400);
    expect(t.payments.products).toEqual([]);
    expect(await activePrices('track_id', track.id)).toEqual([]);
  });

  it('is a 404 for an unknown track and a 400 for a malformed id', async () => {
    expect((await setTrackPrices(randomUUID(), { monthlyAmountMinor: 999, yearlyAmountMinor: null })).status).toBe(404);
    expect((await setTrackPrices('nope', { monthlyAmountMinor: 999, yearlyAmountMinor: null })).status).toBe(400);
  });

  it('is unavailable, and changes nothing, while payments are not configured', async () => {
    const track = await t.track();
    t.payments.configured = false;

    expect((await setTrackPrices(track.id, { monthlyAmountMinor: 999, yearlyAmountMinor: null })).status).toBe(503);
    expect(await activePrices('track_id', track.id)).toEqual([]);
  });

  it('is closed to listeners and anonymous visitors', async () => {
    const track = await t.track();
    const body = { monthlyAmountMinor: 999, yearlyAmountMinor: null };

    expect((await t.asUser.put(`/admin/tracks/${track.id}/prices`, body)).status).toBe(403);
    expect((await t.call(`/admin/tracks/${track.id}/prices`, { method: 'PUT', body })).status).toBe(401);
  });
});

describe('PUT /admin/programs/:id/prices', () => {
  it('prices a program the same way', async () => {
    const program = await t.program({ title: 'Back recovery' });

    const res = await t.api.put(`/admin/programs/${program.id}/prices`, { monthlyAmountMinor: 1999, yearlyAmountMinor: 19900 });

    expect(res.json).toEqual({ month: { amountMinor: 1999, currency: 'usd' }, year: { amountMinor: 19900, currency: 'usd' } });
    expect(t.payments.products[0]).toMatchObject({ name: 'Back recovery' });
    expect(await activePrices('program_id', program.id)).toHaveLength(2);
    expect((await t.api.get(`/admin/programs/${program.id}`)).json.prices.month.amountMinor).toBe(1999);
  });

  it('is a 404 for an unknown program, and closed to listeners', async () => {
    const body = { monthlyAmountMinor: 999, yearlyAmountMinor: null };

    expect((await t.api.put(`/admin/programs/${randomUUID()}/prices`, body)).status).toBe(404);
    expect((await t.asUser.put(`/admin/programs/${randomUUID()}/prices`, body)).status).toBe(403);
  });

  it('shows the program prices to listeners', async () => {
    const track = await t.track({}, { publish: true });
    const program = await t.program({ title: 'Priced' });
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [track.id] });
    await t.api.post(`/admin/programs/${program.id}/publish`);
    await t.api.put(`/admin/programs/${program.id}/prices`, { monthlyAmountMinor: 2500, yearlyAmountMinor: null });

    expect((await t.asUser.get('/catalog/programs')).json.items[0].prices.month.amountMinor).toBe(2500);
    expect((await t.asUser.get('/catalog/programs/priced')).json.prices.month.amountMinor).toBe(2500);
  });
});
