import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../config/app-config.module';
import { StripePaymentsService } from './stripe-payments.service';

const SECRET = 'whsec_test_secret';
const config = (values: Record<string, string | undefined>) => ({ get: (key: string) => values[key] }) as unknown as AppConfig;
const configured = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRET };

const stripe = new Stripe('sk_test_x');
const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'invoice.paid', data: { object: { id: 'in_1' } } });
const sign = (body: string, options: { secret?: string; timestamp?: number } = {}) =>
  stripe.webhooks.generateTestHeaderString({ payload: body, secret: options.secret ?? SECRET, timestamp: options.timestamp });

describe('StripePaymentsService.constructEvent', () => {
  const service = new StripePaymentsService(config(configured));

  it('accepts a correctly signed event and returns its type and object', () => {
    expect(service.constructEvent(Buffer.from(payload), sign(payload))).toEqual({ id: 'evt_1', type: 'invoice.paid', object: { id: 'in_1' } });
  });

  it('rejects a body that was changed after signing', () => {
    const tampered = payload.replace('in_1', 'in_2');

    expect(() => service.constructEvent(Buffer.from(tampered), sign(payload))).toThrow(BadRequestException);
  });

  it('rejects a signature made with a different secret', () => {
    expect(() => service.constructEvent(Buffer.from(payload), sign(payload, { secret: 'whsec_someone_else' }))).toThrow(BadRequestException);
  });

  it('rejects a replay of an old, correctly signed event', () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;

    expect(() => service.constructEvent(Buffer.from(payload), sign(payload, { timestamp: tenMinutesAgo }))).toThrow(BadRequestException);
  });

  it('rejects a missing or garbage signature header', () => {
    expect(() => service.constructEvent(Buffer.from(payload), undefined)).toThrow(BadRequestException);
    expect(() => service.constructEvent(Buffer.from(payload), 'not-a-signature')).toThrow(BadRequestException);
  });

  it('is unavailable, not "bad request", while no webhook secret is configured', () => {
    const unconfigured = new StripePaymentsService(config({ STRIPE_SECRET_KEY: 'sk_test_x' }));

    expect(() => unconfigured.constructEvent(Buffer.from(payload), sign(payload))).toThrow(ServiceUnavailableException);
  });
});

describe('StripePaymentsService (calls to Stripe)', () => {
  const fake = {
    customers: { create: vi.fn() },
    products: { create: vi.fn() },
    prices: { create: vi.fn(), update: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { retrieve: vi.fn(), cancel: vi.fn() },
    invoicePayments: { list: vi.fn() },
  };

  class TestableStripePayments extends StripePaymentsService {
    protected override createClient(): Stripe {
      return fake as unknown as Stripe;
    }
  }
  const service = new TestableStripePayments(config(configured));

  it('is configured only when there is a secret key', () => {
    expect(service.isConfigured()).toBe(true);
    expect(new StripePaymentsService(config({})).isConfigured()).toBe(false);
  });

  it('refuses every call while unconfigured', async () => {
    await expect(new StripePaymentsService(config({})).createCustomer({ userId: 'u', email: 'a@b.dev' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('creates a customer with an idempotency key, so a double click cannot make two', async () => {
    fake.customers.create.mockResolvedValue({ id: 'cus_1' });

    await expect(service.createCustomer({ userId: 'u-1', email: 'a@b.dev' })).resolves.toBe('cus_1');
    expect(fake.customers.create).toHaveBeenCalledWith({ email: 'a@b.dev', metadata: { userId: 'u-1' } }, { idempotencyKey: 'customer:u-1' });
  });

  it('creates a recurring price in the right unit', async () => {
    fake.prices.create.mockResolvedValue({ id: 'price_1' });

    await service.createPrice({ productId: 'prod_1', amountMinor: 999, currency: 'usd', interval: 'YEAR' });

    expect(fake.prices.create).toHaveBeenCalledWith({ product: 'prod_1', unit_amount: 999, currency: 'usd', recurring: { interval: 'year' } });
  });

  it('keeps a long description within Stripe\'s limit', async () => {
    fake.products.create.mockResolvedValue({ id: 'prod_1' });

    await service.createProduct({ name: 'Lung', description: 'x'.repeat(2000) });

    expect(fake.products.create.mock.calls[0]![0].description).toHaveLength(500);
  });

  it('archives a price by deactivating it', async () => {
    await service.archivePrice('price_1');

    expect(fake.prices.update).toHaveBeenCalledWith('price_1', { active: false });
  });

  it('opens a subscription checkout for one price, tagged with the user', async () => {
    fake.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.test/c/1' });

    const url = await service.createCheckoutSession({
      customerId: 'cus_1',
      priceId: 'price_1',
      userId: 'u-1',
      successUrl: 'https://app/ok',
      cancelUrl: 'https://app/no',
      metadata: { userId: 'u-1' },
    });

    expect(url).toBe('https://checkout.stripe.test/c/1');
    expect(fake.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_1',
        line_items: [{ price: 'price_1', quantity: 1 }],
        client_reference_id: 'u-1',
        success_url: 'https://app/ok',
        cancel_url: 'https://app/no',
        subscription_data: { metadata: { userId: 'u-1' } },
      }),
    );
  });

  it('is unavailable when Stripe returns no checkout page', async () => {
    fake.checkout.sessions.create.mockResolvedValue({ url: null });

    await expect(
      service.createCheckoutSession({ customerId: 'c', priceId: 'p', userId: 'u', successUrl: 's', cancelUrl: 'c', metadata: {} }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('opens the billing portal for the customer', async () => {
    fake.billingPortal.sessions.create.mockResolvedValue({ url: 'https://portal.stripe.test/p/1' });

    await expect(service.createPortalSession({ customerId: 'cus_1', returnUrl: 'https://app/library' })).resolves.toBe('https://portal.stripe.test/p/1');
    expect(fake.billingPortal.sessions.create).toHaveBeenCalledWith({ customer: 'cus_1', return_url: 'https://app/library' });
  });

  it.each([
    ['an id', 'in_1', 'in_1'],
    ['an expanded invoice', { id: 'in_2' }, 'in_2'],
  ])('finds the invoice of a payment intent when Stripe returns %s', async (_label, invoice, expected) => {
    fake.invoicePayments.list.mockResolvedValue({ data: [{ invoice }] });

    await expect(service.findInvoiceIdForPaymentIntent('pi_1')).resolves.toBe(expected);
    expect(fake.invoicePayments.list).toHaveBeenCalledWith({ payment: { type: 'payment_intent', payment_intent: 'pi_1' }, limit: 1 });
  });

  it('reports no invoice for a payment that was not an invoice payment', async () => {
    fake.invoicePayments.list.mockResolvedValue({ data: [] });

    await expect(service.findInvoiceIdForPaymentIntent('pi_9')).resolves.toBeNull();
  });
});
