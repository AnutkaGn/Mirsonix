import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startCatalogApp, type CatalogApp } from './helpers/catalog-fixture';
import { DAY_MS } from './helpers/stripe-fixtures';

let t: CatalogApp;

beforeAll(async () => {
  t = await startCatalogApp();
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

const daysAgo = (days: number): Date => new Date(Date.now() - days * DAY_MS);

async function invoice(options: {
  paid: number;
  refunded?: number;
  status?: string;
  paidAt?: Date | null;
}) {
  await t.ds.query(
    `INSERT INTO invoices (user_id, stripe_invoice_id, status, amount_paid_minor, amount_refunded_minor, paid_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      t.listener.id,
      `in_${randomUUID().slice(0, 8)}`,
      options.status ?? 'PAID',
      options.paid,
      options.refunded ?? 0,
      options.paidAt === undefined ? new Date() : options.paidAt,
    ],
  );
}

async function listen(
  trackId: string,
  options: { programId?: string; counted?: boolean; startedAt?: Date } = {},
) {
  await t.ds.query(
    `INSERT INTO playback_sessions (user_id, track_id, program_id, counted_as_listen, started_at) VALUES ($1, $2, $3, $4, $5)`,
    [
      t.listener.id,
      trackId,
      options.programId ?? null,
      options.counted ?? true,
      options.startedAt ?? new Date(),
    ],
  );
}

async function backdate(subscriptionId: string, createdAt: Date) {
  await t.ds.query(`UPDATE subscriptions SET created_at = $1 WHERE id = $2`, [
    createdAt,
    subscriptionId,
  ]);
}

describe('access', () => {
  it.each(['/admin/stats/summary', '/admin/stats/revenue', '/admin/stats/top'])(
    '%s is closed to listeners and visitors',
    async (path) => {
      expect((await t.asUser.get(path)).status).toBe(403);
      expect((await t.call(path)).status).toBe(401);
    },
  );

  it.each(['days=0', 'days=366', 'days=abc'])('rejects %s', async (query) => {
    expect((await t.api.get(`/admin/stats/summary?${query}`)).status).toBe(400);
  });

  it('rejects an oversized top limit', async () => {
    expect((await t.api.get('/admin/stats/top?limit=21')).status).toBe(400);
  });
});

describe('GET /admin/stats/summary', () => {
  it('is all zeros on an empty platform', async () => {
    const res = await t.api.get('/admin/stats/summary');

    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      periodDays: 30,
      currency: 'usd',
      activeSubscriptions: { total: 0, tracks: 0, programs: 0 },
      revenue: { grossMinor: 0, refundedMinor: 0, netMinor: 0 },
      newSubscriptions: 0,
      listens: 0,
    });
  });

  it('counts only subscriptions that grant access right now', async () => {
    const track = await t.track({}, { publish: true });
    const program = await t.program();
    const other = await t.signIn('USER');
    await t.subscribe(t.listener, { kind: 'TRACK', id: track.id });
    await t.subscribe(t.listener, { kind: 'PROGRAM', id: program.id });
    await t.subscribe(other, { kind: 'TRACK', id: track.id }, { status: 'PAST_DUE' });
    const third = await t.signIn('USER');
    await t.subscribe(third, { kind: 'TRACK', id: track.id }, { status: 'CANCELED' });
    const fourth = await t.signIn('USER');
    await t.subscribe(fourth, { kind: 'TRACK', id: track.id }, { periodEnd: daysAgo(2) }); // missed webhooks: distrusted

    const { json } = await t.api.get('/admin/stats/summary');

    expect(json.activeSubscriptions).toEqual({ total: 2, tracks: 1, programs: 1 });
  });

  it('sums paid invoices in the window and nets out refunds', async () => {
    await invoice({ paid: 1000, refunded: 250 });
    await invoice({ paid: 2000 });
    await invoice({ paid: 9999, status: 'OPEN', paidAt: null });
    await invoice({ paid: 7777, paidAt: daysAgo(40) });

    const { json } = await t.api.get('/admin/stats/summary');
    const longer = await t.api.get('/admin/stats/summary?days=60');

    expect(json.revenue).toEqual({ grossMinor: 3000, refundedMinor: 250, netMinor: 2750 });
    expect(longer.json.revenue.grossMinor).toBe(10_777);
  });

  it('counts new subscriptions in the window, ignoring abandoned checkouts', async () => {
    const track = await t.track({}, { publish: true });
    const users = [await t.signIn('USER'), await t.signIn('USER'), await t.signIn('USER')];
    await t.subscribe(users[0]!, { kind: 'TRACK', id: track.id });
    await t.subscribe(users[1]!, { kind: 'TRACK', id: track.id }, { status: 'INCOMPLETE' });
    const old = await t.subscribe(users[2]!, { kind: 'TRACK', id: track.id });
    await backdate(old, daysAgo(45));

    const { json } = await t.api.get('/admin/stats/summary');

    expect(json.newSubscriptions).toBe(1);
  });

  it('counts only listens that reached the threshold, inside the window', async () => {
    const track = await t.track({}, { publish: true });
    await listen(track.id);
    await listen(track.id, { counted: false });
    await listen(track.id, { startedAt: daysAgo(40) });

    expect((await t.api.get('/admin/stats/summary')).json.listens).toBe(1);
    expect((await t.api.get('/admin/stats/summary?days=60')).json.listens).toBe(2);
  });
});

describe('GET /admin/stats/revenue', () => {
  it('returns one point per day, with empty days at zero', async () => {
    await invoice({ paid: 1000, refunded: 100 });
    await invoice({ paid: 500, paidAt: daysAgo(2) });

    const res = await t.api.get('/admin/stats/revenue?days=4');

    expect(res.status).toBe(200);
    expect(res.json.items).toHaveLength(4);
    expect(res.json.items.map((p: { netMinor: number }) => p.netMinor)).toEqual([0, 500, 0, 900]);
    const dates: string[] = res.json.items.map((p: { date: string }) => p.date);
    expect([...dates].sort()).toEqual(dates);
    expect(dates.at(-1)).toBe(new Date().toISOString().slice(0, 10));
  });

  it('leaves out revenue older than the window', async () => {
    await invoice({ paid: 5000, paidAt: daysAgo(10) });

    const { json } = await t.api.get('/admin/stats/revenue?days=3');

    expect(json.items.every((p: { netMinor: number }) => p.netMinor === 0)).toBe(true);
  });
});

describe('GET /admin/stats/top', () => {
  it('ranks tracks and programs by sales and by listens', async () => {
    const popular = await t.track({ title: 'Popular' }, { publish: true });
    const quiet = await t.track({ title: 'Quiet' }, { publish: true });
    const program = await t.program({ title: 'Series' });
    const [a, b] = [await t.signIn('USER'), await t.signIn('USER')];
    await t.subscribe(a, { kind: 'TRACK', id: popular.id });
    await t.subscribe(b, { kind: 'TRACK', id: popular.id });
    await t.subscribe(a, { kind: 'TRACK', id: quiet.id });
    await t.subscribe(a, { kind: 'PROGRAM', id: program.id });
    await listen(quiet.id);
    await listen(quiet.id);
    await listen(popular.id);
    await listen(popular.id, { counted: false });
    await listen(popular.id, { programId: program.id });

    const { status, json } = await t.api.get('/admin/stats/top');

    expect(status).toBe(200);
    expect(json.sales.tracks).toEqual([
      { id: popular.id, title: 'Popular', count: 2 },
      { id: quiet.id, title: 'Quiet', count: 1 },
    ]);
    expect(json.sales.programs).toEqual([{ id: program.id, title: 'Series', count: 1 }]);
    // a tie is broken by title
    expect(json.listens.tracks).toEqual([
      { id: popular.id, title: 'Popular', count: 2 },
      { id: quiet.id, title: 'Quiet', count: 2 },
    ]);
    expect(json.listens.programs).toEqual([{ id: program.id, title: 'Series', count: 1 }]);
  });

  it('honours the limit and the period', async () => {
    const tracks = [
      await t.track({ title: 'A' }, { publish: true }),
      await t.track({ title: 'B' }, { publish: true }),
    ];
    await listen(tracks[0]!.id);
    await listen(tracks[1]!.id, { startedAt: daysAgo(40) });

    const limited = await t.api.get('/admin/stats/top?limit=1&days=60');
    const recent = await t.api.get('/admin/stats/top');

    expect(limited.json.listens.tracks).toHaveLength(1);
    expect(recent.json.listens.tracks.map((x: { title: string }) => x.title)).toEqual(['A']);
  });
});
