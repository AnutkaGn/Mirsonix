import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startCatalogApp, type CatalogApp } from './helpers/catalog-fixture';
import { DAY_MS, HOUR_MS, stripeCharge, stripeEvent, stripeInvoice, stripeSubscription } from './helpers/stripe-fixtures';

let t: CatalogApp;

beforeAll(async () => {
  t = await startCatalogApp();
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

/** A listener with a Stripe customer, and a published track on sale. */
async function scene() {
  const customer = await t.customerOf(t.listener);
  const track = await t.track({}, { publish: true });
  const price = await t.price({ kind: 'TRACK', id: track.id }, 'MONTH', 999);
  return { customer, track, price };
}

const subscriptionRow = async (stripeId: string) =>
  (await t.ds.query(`SELECT s.*, p.track_id AS price_track_id FROM subscriptions s JOIN prices p ON p.id = s.price_id WHERE s.stripe_subscription_id = $1`, [stripeId]))[0];
const eventRow = async (id: string) => (await t.ds.query(`SELECT status, error, payload FROM stripe_events WHERE id = $1`, [id]))[0];
const invoiceRow = async (stripeId: string) => (await t.ds.query(`SELECT * FROM invoices WHERE stripe_invoice_id = $1`, [stripeId]))[0];
const canStream = async (trackId: string) => (await t.asUser.post(`/stream/tracks/${trackId}/url`)).status === 200;
const send = (type: string, object: { id: string }, id?: string) => t.sendWebhook(stripeEvent(type, object, id));

describe('delivery', () => {
  it('rejects a request that is not signed, or signed wrongly, and records nothing', async () => {
    const { customer, price } = await scene();
    const event = stripeEvent('customer.subscription.created', stripeSubscription({ customer, priceId: price.stripePriceId }));

    expect((await t.sendWebhook(event, { signature: 'forged' })).status).toBe(400);
    const [{ count }] = await t.ds.query(`SELECT count(*)::int AS count FROM stripe_events`);
    expect(count).toBe(0);
  });

  it('acknowledges an event type it does not handle, and remembers it', async () => {
    const res = await send('customer.created', { id: 'cus_x' }, 'evt_ignored');

    expect(res).toMatchObject({ status: 200, json: { received: true, result: 'ignored' } });
    expect((await eventRow('evt_ignored')).status).toBe('PROCESSED');
  });

  it('applies an event once, however many times Stripe delivers it', async () => {
    const { customer, track, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });

    const first = await send('customer.subscription.created', sub, 'evt_same');
    await t.ds.query(`UPDATE subscriptions SET status = 'CANCELED' WHERE stripe_subscription_id = $1`, [sub.id]); // a later change
    const second = await send('customer.subscription.created', sub, 'evt_same');

    expect(first.json.result).toBe('processed');
    expect(second.json.result).toBe('duplicate');
    expect((await subscriptionRow(sub.id)).status).toBe('CANCELED'); // the replay did not undo it
    expect(await canStream(track.id)).toBe(false);
  });

  it('keeps no personal data from the payload, only a reference to the object', async () => {
    const { customer, price } = await scene();
    const sub = { ...stripeSubscription({ customer, priceId: price.stripePriceId }), email: 'someone@example.com', metadata: { note: 'private' } };

    await send('customer.subscription.created', sub, 'evt_private');

    const row = await eventRow('evt_private');
    expect(row.payload).toEqual({ objectId: sub.id });
    expect(JSON.stringify(row)).not.toContain('someone@example.com');
  });
});

describe('subscription events', () => {
  it('turns a new subscription into access', async () => {
    const { customer, track, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId, periodEnd: new Date(Date.now() + 30 * DAY_MS) });
    expect(await canStream(track.id)).toBe(false);

    await send('customer.subscription.created', sub);

    expect(await subscriptionRow(sub.id)).toMatchObject({
      user_id: t.listener.id,
      track_id: track.id,
      program_id: null,
      price_id: price.id,
      status: 'ACTIVE',
      cancel_at_period_end: false,
    });
    expect(await canStream(track.id)).toBe(true);
    expect((await t.asUser.get('/library')).json.tracks.map((x: { id: string }) => x.id)).toEqual([track.id]);
  });

  it('records a cancellation at period end and keeps access until then', async () => {
    const { customer, track, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });
    await send('customer.subscription.created', sub);

    await send('customer.subscription.updated', { ...sub, cancel_at_period_end: true, canceled_at: Math.floor(Date.now() / 1000) });

    expect(await subscriptionRow(sub.id)).toMatchObject({ cancel_at_period_end: true, status: 'ACTIVE' });
    expect(await canStream(track.id)).toBe(true);
    expect((await t.asUser.get('/library')).json.tracks[0].access.cancelAtPeriodEnd).toBe(true);
  });

  it('cuts access when a payment fails, and restores it when the payment goes through', async () => {
    const { customer, track, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });
    await send('customer.subscription.created', sub);

    await send('customer.subscription.updated', { ...sub, status: 'past_due' });
    expect(await canStream(track.id)).toBe(false);

    await send('customer.subscription.updated', { ...sub, status: 'active' });
    expect(await canStream(track.id)).toBe(true);
  });

  it('ends access when the subscription is deleted, and lets the listener buy again', async () => {
    const { customer, track, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });
    await send('customer.subscription.created', sub);

    await send('customer.subscription.deleted', { ...sub, status: 'canceled', canceled_at: Math.floor(Date.now() / 1000) });

    expect((await subscriptionRow(sub.id)).status).toBe('CANCELED');
    expect(await canStream(track.id)).toBe(false);
    expect((await t.asUser.post('/billing/checkout', { trackId: track.id, interval: 'MONTH' })).status).toBe(200);
  });

  it('extends access when the subscription renews', async () => {
    const { customer, track, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId, periodEnd: new Date(Date.now() - 7 * HOUR_MS) });
    await send('customer.subscription.created', sub);
    expect(await canStream(track.id)).toBe(false); // the period ended long ago and no renewal arrived

    await send('customer.subscription.updated', stripeSubscription({ id: sub.id, customer, priceId: price.stripePriceId, periodEnd: new Date(Date.now() + 30 * DAY_MS) }));

    expect(await canStream(track.id)).toBe(true);
  });

  it('copes with an update arriving before the creation, ending with a single row', async () => {
    const { customer, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });

    await send('customer.subscription.updated', sub);
    await send('customer.subscription.created', sub);

    const rows = await t.ds.query(`SELECT id FROM subscriptions WHERE stripe_subscription_id = $1`, [sub.id]);
    expect(rows).toHaveLength(1);
  });

  it('sells a program: the subscription opens its tracks', async () => {
    const customer = await t.customerOf(t.listener);
    const [inside, outside] = [await t.track({}, { publish: true }), await t.track({}, { publish: true })];
    const program = await t.program();
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [inside.id] });
    const price = await t.price({ kind: 'PROGRAM', id: program.id }, 'YEAR', 19900);

    await send('customer.subscription.created', stripeSubscription({ customer, priceId: price.stripePriceId }));

    expect(await canStream(inside.id)).toBe(true);
    expect(await canStream(outside.id)).toBe(false);
  });

  it('takes the target from our price table, never from metadata in the payload', async () => {
    const { customer, track, price } = await scene();
    const other = await t.track({}, { publish: true });
    const sub = { ...stripeSubscription({ customer, priceId: price.stripePriceId }), metadata: { targetKind: 'TRACK', targetId: other.id, userId: 'someone-else' } };

    await send('customer.subscription.created', sub);

    expect(await canStream(track.id)).toBe(true);
    expect(await canStream(other.id)).toBe(false);
  });

  it('treats a status it does not know as no access', async () => {
    const { customer, track, price } = await scene();

    await send('customer.subscription.created', stripeSubscription({ customer, priceId: price.stripePriceId, status: 'some_future_status' }));

    expect(await canStream(track.id)).toBe(false);
  });

  it.each([
    ['a customer we do not know', (customer: string, priceId: string) => stripeSubscription({ customer: 'cus_stranger', priceId })],
    ['a price we do not sell', (customer: string) => stripeSubscription({ customer, priceId: 'price_from_another_product' })],
  ])('sets aside a subscription for %s, without failing', async (_label, build) => {
    const { customer, price } = await scene();
    const sub = build(customer, price.stripePriceId);

    const res = await send('customer.subscription.created', sub, 'evt_aside');

    expect(res.status).toBe(200);
    expect(await subscriptionRow(sub.id)).toBeUndefined();
    expect((await eventRow('evt_aside')).status).toBe('PROCESSED');
  });

  it('cancels a second live subscription to the same track, so the listener is not billed twice', async () => {
    const { customer, track, price } = await scene();
    const first = stripeSubscription({ customer, priceId: price.stripePriceId });
    const duplicate = stripeSubscription({ customer, priceId: price.stripePriceId });
    await send('customer.subscription.created', first);

    const res = await send('customer.subscription.created', duplicate);

    expect(res.status).toBe(200);
    expect(t.payments.canceledSubscriptions).toEqual([duplicate.id]);
    expect(await subscriptionRow(duplicate.id)).toBeUndefined();
    expect((await subscriptionRow(first.id)).status).toBe('ACTIVE');
    expect(await canStream(track.id)).toBe(true);
  });

  describe('a payload that cannot be understood', () => {
    it('fails loudly so Stripe retries, and keeps the reason', async () => {
      const res = await send('customer.subscription.created', { id: 'sub_broken' } as never, 'evt_broken');

      expect(res.status).toBe(500);
      const row = await eventRow('evt_broken');
      expect(row.status).toBe('FAILED');
      expect(row.error).toBeTruthy();
    });

    it('is processed on a later delivery once the payload is good', async () => {
      const { customer, track, price } = await scene();
      await send('customer.subscription.created', { id: 'sub_broken' } as never, 'evt_retry');

      const retry = await send('customer.subscription.created', stripeSubscription({ customer, priceId: price.stripePriceId }), 'evt_retry');

      expect(retry.json.result).toBe('processed');
      expect((await eventRow('evt_retry')).status).toBe('PROCESSED');
      expect(await canStream(track.id)).toBe(true);
    });
  });
});

describe('invoice events', () => {
  it('records a paid invoice against its subscription', async () => {
    const { customer, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });
    await send('customer.subscription.created', sub);
    const invoice = stripeInvoice({ customer, subscriptionId: sub.id, amountPaid: 999 });

    await send('invoice.paid', invoice);

    expect(await invoiceRow(invoice.id)).toMatchObject({
      user_id: t.listener.id,
      subscription_id: (await subscriptionRow(sub.id)).id,
      status: 'PAID',
      amount_paid_minor: 999,
      amount_refunded_minor: 0,
      currency: 'usd',
    });
    expect((await invoiceRow(invoice.id)).paid_at).toBeTruthy();
  });

  it('fetches the subscription itself when its invoice arrives first', async () => {
    const { customer, track, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });
    t.payments.stripeSubscriptions.set(sub.id, sub);
    const invoice = stripeInvoice({ customer, subscriptionId: sub.id });

    await send('invoice.paid', invoice);

    expect((await invoiceRow(invoice.id)).subscription_id).toBe((await subscriptionRow(sub.id)).id);
    expect(await canStream(track.id)).toBe(true);
  });

  it('records a failed payment as unpaid', async () => {
    const { customer, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });
    await send('customer.subscription.created', sub);
    const invoice = stripeInvoice({ customer, subscriptionId: sub.id, status: 'open', amountPaid: 0 });

    await send('invoice.payment_failed', invoice);

    expect(await invoiceRow(invoice.id)).toMatchObject({ status: 'OPEN', amount_paid_minor: 0 });
  });

  it('keeps an invoice that belongs to no subscription', async () => {
    const { customer } = await scene();
    const invoice = stripeInvoice({ customer, subscriptionId: null });

    await send('invoice.paid', invoice);

    expect((await invoiceRow(invoice.id)).subscription_id).toBeNull();
  });

  it('sets aside an invoice for a customer we do not know', async () => {
    const invoice = stripeInvoice({ customer: 'cus_stranger' });

    expect((await send('invoice.paid', invoice)).status).toBe(200);
    expect(await invoiceRow(invoice.id)).toBeUndefined();
  });

  it('does not erase a refund when the invoice is delivered again', async () => {
    const { customer, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });
    await send('customer.subscription.created', sub);
    const invoice = stripeInvoice({ customer, subscriptionId: sub.id });
    await send('invoice.paid', invoice);
    await t.ds.query(`UPDATE invoices SET amount_refunded_minor = 500 WHERE stripe_invoice_id = $1`, [invoice.id]);

    await send('invoice.paid', invoice); // a fresh delivery of the same invoice, under a new event id

    expect((await invoiceRow(invoice.id)).amount_refunded_minor).toBe(500);
  });
});

describe('refunds', () => {
  it('records a refund against the invoice it came from', async () => {
    const { customer, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });
    await send('customer.subscription.created', sub);
    const invoice = stripeInvoice({ customer, subscriptionId: sub.id, amountPaid: 999 });
    await send('invoice.paid', invoice);
    t.payments.invoiceByPaymentIntent.set('pi_1', invoice.id);

    await send('charge.refunded', stripeCharge({ amountRefunded: 400, paymentIntent: 'pi_1' }));

    expect((await invoiceRow(invoice.id)).amount_refunded_minor).toBe(400);
  });

  it('tracks a growing refund as the cumulative amount', async () => {
    const { customer, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });
    await send('customer.subscription.created', sub);
    const invoice = stripeInvoice({ customer, subscriptionId: sub.id });
    await send('invoice.paid', invoice);
    t.payments.invoiceByPaymentIntent.set('pi_2', invoice.id);

    await send('charge.refunded', stripeCharge({ id: 'ch_a', amountRefunded: 300, paymentIntent: 'pi_2' }));
    await send('charge.refunded', stripeCharge({ id: 'ch_a', amountRefunded: 999, paymentIntent: 'pi_2' }));

    expect((await invoiceRow(invoice.id)).amount_refunded_minor).toBe(999);
  });

  it('asks Stripe to deliver again when the refund beats its invoice, and succeeds once the invoice is in', async () => {
    const { customer, price } = await scene();
    const sub = stripeSubscription({ customer, priceId: price.stripePriceId });
    await send('customer.subscription.created', sub);
    const invoice = stripeInvoice({ customer, subscriptionId: sub.id });
    t.payments.invoiceByPaymentIntent.set('pi_3', invoice.id);
    const refund = stripeEvent('charge.refunded', stripeCharge({ amountRefunded: 250, paymentIntent: 'pi_3' }), 'evt_refund');

    expect((await t.sendWebhook(refund)).status).toBe(500);
    expect((await eventRow('evt_refund')).status).toBe('FAILED');

    await send('invoice.paid', invoice);
    expect((await t.sendWebhook(refund)).json.result).toBe('processed');
    expect((await invoiceRow(invoice.id)).amount_refunded_minor).toBe(250);
  });

  it('ignores a charge that is not part of an invoice', async () => {
    const res = await send('charge.refunded', stripeCharge({ amountRefunded: 100, paymentIntent: 'pi_one_off' }));

    expect(res.status).toBe(200);
  });
});

describe('from checkout to playback', () => {
  it('lets a listener buy a track, and play it once Stripe confirms the payment', async () => {
    const track = await t.track({}, { publish: true });
    const price = await t.price({ kind: 'TRACK', id: track.id }, 'MONTH', 999);
    expect(await canStream(track.id)).toBe(false);

    const checkout = await t.asUser.post('/billing/checkout', { trackId: track.id, interval: 'MONTH' });
    expect(checkout.status).toBe(200);
    expect(await canStream(track.id)).toBe(false); // opening the checkout page grants nothing

    const customer = t.payments.checkouts[0]!.customerId;
    const sub = stripeSubscription({ customer, priceId: t.payments.checkouts[0]!.priceId });
    await send('customer.subscription.created', sub);
    await send('invoice.paid', stripeInvoice({ customer, subscriptionId: sub.id }));

    expect(price.stripePriceId).toBe(t.payments.checkouts[0]!.priceId);
    expect(await canStream(track.id)).toBe(true);
    expect((await t.asUser.get('/library')).json.tracks).toHaveLength(1);
  });
});
