import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { seedReferenceData } from '../../src/database/seeds/reference-seed';
import { FakePayments, VALID_SIGNATURE } from './fake-payments';
import { FakeStorage } from './fake-storage';
import { createHttp, type CallResult } from './http';
import { createTestApp, type TestApp } from './test-app';
import { createTestDataSource } from './test-db';

export interface Actor {
  id: string;
  token: string;
}

const PASSWORD = 'correct-horse-9';
let counter = 0;

/** Boots the real app on the test database with fake storage, and hands back helpers to build catalog data. */
export async function startCatalogApp() {
  const ds: DataSource = await createTestDataSource();
  await ds.transaction((em) => seedReferenceData(em));
  const storage = new FakeStorage();
  const payments = new FakePayments();
  const app: TestApp = await createTestApp({}, (builder, tokens) =>
    builder.overrideProvider(tokens.StoragePort).useValue(storage).overrideProvider(tokens.PaymentsPort).useValue(payments),
  );
  const call = createHttp(() => app.url);

  async function signIn(role: 'ADMIN' | 'USER'): Promise<Actor> {
    const email = `${role.toLowerCase()}${++counter}-${Date.now()}@test.dev`;
    await call('/auth/register', { body: { email, password: PASSWORD } });
    await ds.query(`UPDATE users SET role = $1 WHERE email = $2`, [role, email]);
    const login = await call('/auth/login', { body: { email, password: PASSWORD } }); // a new token carries the new role
    return { id: login.json.user.id, token: login.json.accessToken };
  }

  const [admin, listener] = [await signIn('ADMIN'), await signIn('USER')];

  /** Inserts a finished upload straight into the database, so most tests skip the two-step upload flow. */
  async function asset(
    kind: 'AUDIO' | 'IMAGE',
    overrides: { status?: 'PENDING' | 'READY' | 'FAILED'; durationMs?: number | null } = {},
  ): Promise<string> {
    const audio = kind === 'AUDIO';
    const [row] = await ds.query(
      `INSERT INTO media_assets (kind, bucket, s3_key, mime_type, size_bytes, duration_ms, status, uploaded_by_id)
       VALUES ($1, 'test-bucket', $2, $3, 1000, $4, $5, $6) RETURNING id`,
      [
        kind,
        `${audio ? 'audio' : 'covers'}/${randomUUID()}.${audio ? 'mp3' : 'png'}`,
        audio ? 'audio/mpeg' : 'image/png',
        overrides.durationMs === undefined ? (audio ? 600_000 : null) : overrides.durationMs,
        overrides.status ?? 'READY',
        admin.id,
      ],
    );
    return row.id;
  }

  const meridianId = async (code: string): Promise<string> => (await ds.query(`SELECT id FROM meridians WHERE code = $1`, [code]))[0].id;
  const issueId = async (slug: string): Promise<string> => (await ds.query(`SELECT id FROM issues WHERE slug = $1`, [slug]))[0].id;

  const as = (actor: Actor) => ({
    get: (path: string) => call(path, { token: actor.token }),
    post: (path: string, body?: unknown) => call(path, { method: 'POST', body: body ?? {}, token: actor.token }),
    patch: (path: string, body: unknown) => call(path, { method: 'PATCH', body, token: actor.token }),
    put: (path: string, body: unknown) => call(path, { method: 'PUT', body, token: actor.token }),
  });
  const api = as(admin);

  /** A draft track with audio and a cover. Pass `publish` to release it too. */
  async function track(
    overrides: Record<string, unknown> = {},
    options: { publish?: boolean } = {},
  ): Promise<CallResult['json']> {
    const created = await api.post('/admin/tracks', {
      title: `Track ${++counter}`,
      description: 'A calming track.',
      audioAssetId: await asset('AUDIO'),
      coverAssetId: await asset('IMAGE'),
      ...overrides,
    });
    if (created.status !== 201) throw new Error(`track fixture failed: ${created.status} ${JSON.stringify(created.json)}`);
    if (!options.publish) return created.json;
    const published = await api.post(`/admin/tracks/${created.json.id}/publish`);
    if (published.status !== 200) throw new Error(`publish fixture failed: ${JSON.stringify(published.json)}`);
    return published.json;
  }

  async function program(overrides: Record<string, unknown> = {}): Promise<CallResult['json']> {
    const created = await api.post('/admin/programs', {
      title: `Program ${++counter}`,
      description: 'A guided series.',
      posterAssetId: await asset('IMAGE'),
      ...overrides,
    });
    if (created.status !== 201) throw new Error(`program fixture failed: ${created.status} ${JSON.stringify(created.json)}`);
    return created.json;
  }

  type Target = { kind: 'TRACK' | 'PROGRAM'; id: string };
  const targetColumns = (target: Target) => (target.kind === 'TRACK' ? [target.id, null] : [null, target.id]);

  /** An active price straight in the database (reusing the active one if there is one), without going through Stripe. */
  async function price(target: Target, interval: 'MONTH' | 'YEAR' = 'MONTH', amountMinor = 999): Promise<{ id: string; stripePriceId: string }> {
    const [trackId, programId] = targetColumns(target);
    const [existing] = await ds.query(
      `SELECT id, stripe_price_id FROM prices WHERE track_id IS NOT DISTINCT FROM $1 AND program_id IS NOT DISTINCT FROM $2 AND interval = $3 AND is_active`,
      [trackId, programId, interval],
    );
    if (existing) return { id: existing.id, stripePriceId: existing.stripe_price_id };
    const stripePriceId = `price_db_${randomUUID().slice(0, 8)}`;
    const [row] = await ds.query(
      `INSERT INTO prices (track_id, program_id, interval, stripe_price_id, amount_minor) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [trackId, programId, interval, stripePriceId, amountMinor],
    );
    return { id: row.id, stripePriceId };
  }

  /** Gives the user a Stripe customer id, as a first checkout would. */
  async function customerOf(actor: Actor): Promise<string> {
    const customerId = `cus_db_${actor.id.slice(0, 8)}`;
    await ds.query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [customerId, actor.id]);
    return customerId;
  }

  /** A subscription row as Stripe's webhooks would have left it. Defaults to active for 30 more days. */
  async function subscribe(
    actor: Actor,
    target: Target,
    options: { status?: string; periodEnd?: Date | null; cancelAtPeriodEnd?: boolean } = {},
  ): Promise<string> {
    const [trackId, programId] = targetColumns(target);
    const { id: priceId } = await price(target);
    const periodEnd = options.periodEnd === undefined ? new Date(Date.now() + 30 * 24 * 3600 * 1000) : options.periodEnd;
    const [row] = await ds.query(
      `INSERT INTO subscriptions (user_id, track_id, program_id, price_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [actor.id, trackId, programId, priceId, `sub_db_${randomUUID().slice(0, 8)}`, options.status ?? 'ACTIVE', periodEnd, options.cancelAtPeriodEnd ?? false],
    );
    return row.id;
  }

  /** Delivers a Stripe webhook the way Stripe does: the exact JSON bytes plus a signature header. */
  async function sendWebhook(event: object, options: { signature?: string } = {}): Promise<{ status: number; json: { received?: boolean; result?: string } }> {
    const res = await fetch(`${app.url}/billing/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': options.signature ?? VALID_SIGNATURE },
      body: JSON.stringify(event),
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : {} };
  }

  /** Empties the catalog tables so every test starts from a clean slate (users and taxonomy are kept). */
  async function reset(): Promise<void> {
    await ds.query(`TRUNCATE tracks, programs, media_assets, audit_logs, invoices, stripe_events CASCADE`);
    await ds.query(`UPDATE users SET stripe_customer_id = NULL`); // a customer is created by the first checkout, so tests start without
    storage.reset();
    payments.reset();
  }

  return {
    ds,
    app,
    call,
    storage,
    payments,
    signIn,
    price,
    customerOf,
    subscribe,
    sendWebhook,
    admin,
    listener,
    api,
    asUser: as(listener),
    as,
    asset,
    track,
    program,
    meridianId,
    issueId,
    reset,
    stop: async () => {
      await app.close();
      await ds.destroy();
    },
  };
}

export type CatalogApp = Awaited<ReturnType<typeof startCatalogApp>>;
