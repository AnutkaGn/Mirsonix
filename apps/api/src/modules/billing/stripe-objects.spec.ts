import { describe, expect, it } from 'vitest';
import {
  stripeChargeSchema,
  stripeInvoiceSchema,
  stripeSubscriptionSchema,
  toInvoiceStatus,
  toSubscriptionStatus,
} from './stripe-objects';

const PERIOD_START = 1_800_000_000;
const PERIOD_END = 1_802_592_000;

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: false,
  canceled_at: null,
  items: { data: [{ price: { id: 'price_1' }, current_period_start: PERIOD_START, current_period_end: PERIOD_END }] },
  ...overrides,
});

describe('stripeSubscriptionSchema', () => {
  it('reads the billing period from the subscription item (current API)', () => {
    expect(stripeSubscriptionSchema.parse(subscription())).toEqual({
      id: 'sub_1',
      customerId: 'cus_1',
      status: 'active',
      cancelAtPeriodEnd: false,
      canceledAt: null,
      priceId: 'price_1',
      currentPeriodStart: new Date(PERIOD_START * 1000),
      currentPeriodEnd: new Date(PERIOD_END * 1000),
    });
  });

  it('still reads the period from the subscription itself (older API versions)', () => {
    const legacy = subscription({
      current_period_start: PERIOD_START,
      current_period_end: PERIOD_END,
      items: { data: [{ price: { id: 'price_1' } }] },
    });

    expect(stripeSubscriptionSchema.parse(legacy).currentPeriodEnd).toEqual(new Date(PERIOD_END * 1000));
  });

  it('accepts an expanded customer object and a cancellation time', () => {
    const parsed = stripeSubscriptionSchema.parse(subscription({ customer: { id: 'cus_2' }, canceled_at: PERIOD_START, cancel_at_period_end: true }));

    expect(parsed).toMatchObject({ customerId: 'cus_2', cancelAtPeriodEnd: true, canceledAt: new Date(PERIOD_START * 1000) });
  });

  it('leaves the period null rather than inventing one when Stripe sends none', () => {
    const parsed = stripeSubscriptionSchema.parse(subscription({ items: { data: [{ price: { id: 'price_1' } }] } }));

    expect(parsed.currentPeriodEnd).toBeNull();
  });

  it.each([
    ['no items', { items: { data: [] } }],
    ['a missing customer', { customer: undefined }],
    ['a non-boolean cancel flag', { cancel_at_period_end: 'yes' }],
  ])('rejects a payload with %s', (_label, overrides) => {
    expect(stripeSubscriptionSchema.safeParse(subscription(overrides)).success).toBe(false);
  });
});

describe('stripeInvoiceSchema', () => {
  const invoice = (overrides: Record<string, unknown> = {}) => ({
    id: 'in_1',
    customer: 'cus_1',
    status: 'paid',
    amount_paid: 999,
    currency: 'usd',
    status_transitions: { paid_at: PERIOD_START },
    parent: { subscription_details: { subscription: 'sub_1' } },
    ...overrides,
  });

  it('finds the subscription under parent.subscription_details (current API)', () => {
    expect(stripeInvoiceSchema.parse(invoice())).toEqual({
      id: 'in_1',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      status: 'paid',
      amountPaidMinor: 999,
      currency: 'usd',
      paidAt: new Date(PERIOD_START * 1000),
    });
  });

  it('still finds a top-level subscription (older API versions)', () => {
    expect(stripeInvoiceSchema.parse(invoice({ parent: null, subscription: 'sub_legacy' })).subscriptionId).toBe('sub_legacy');
  });

  it('allows an invoice that belongs to no subscription, and one that has not been paid', () => {
    const parsed = stripeInvoiceSchema.parse(invoice({ parent: null, status: 'open', amount_paid: 0, status_transitions: {} }));

    expect(parsed).toMatchObject({ subscriptionId: null, paidAt: null, amountPaidMinor: 0 });
  });
});

describe('stripeChargeSchema', () => {
  it('reads the refunded amount and the payment intent', () => {
    expect(stripeChargeSchema.parse({ id: 'ch_1', amount_refunded: 500, payment_intent: 'pi_1' })).toEqual({
      id: 'ch_1',
      amountRefundedMinor: 500,
      paymentIntentId: 'pi_1',
      invoiceId: null,
    });
  });

  it('rejects a charge without an amount', () => {
    expect(stripeChargeSchema.safeParse({ id: 'ch_1' }).success).toBe(false);
  });
});

describe('status mapping', () => {
  it.each([
    ['active', 'ACTIVE'],
    ['trialing', 'TRIALING'],
    ['past_due', 'PAST_DUE'],
    ['canceled', 'CANCELED'],
    ['unpaid', 'UNPAID'],
    ['incomplete', 'INCOMPLETE'],
    ['incomplete_expired', 'INCOMPLETE_EXPIRED'],
    ['paused', 'PAUSED'],
  ])('maps the subscription status %s to %s', (stripe, ours) => {
    expect(toSubscriptionStatus(stripe)).toBe(ours);
  });

  it('treats a status it does not know as no access, never as access', () => {
    expect(toSubscriptionStatus('some_future_status')).toBe('UNPAID');
  });

  it.each([
    ['draft', 'DRAFT'],
    ['open', 'OPEN'],
    ['paid', 'PAID'],
    ['uncollectible', 'UNCOLLECTIBLE'],
    ['void', 'VOID'],
    [null, 'OPEN'],
    ['something_new', 'OPEN'],
  ])('maps the invoice status %s to %s', (stripe, ours) => {
    expect(toInvoiceStatus(stripe)).toBe(ours);
  });
});
