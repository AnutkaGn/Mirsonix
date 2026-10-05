import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User } from '../src/modules/users/entities/user.entity';
import { createTestDataSource } from './helpers/test-db';

let ds: DataSource;

beforeAll(async () => {
  ds = await createTestDataSource();
});
afterAll(async () => {
  await ds.destroy();
});

const sql = (q: string, params: unknown[] = []) => ds.query(q, params);
const uid = () => randomUUID().slice(0, 8);

async function mkUser(email = `u-${uid()}@test.dev`): Promise<string> {
  const [row] = await sql(`INSERT INTO users (email, role) VALUES ($1, 'USER') RETURNING id`, [email]);
  return row.id;
}
async function mkAsset(userId: string): Promise<string> {
  const [row] = await sql(
    `INSERT INTO media_assets (kind, bucket, s3_key, mime_type, size_bytes, uploaded_by_id)
     VALUES ('AUDIO', 'b', $1, 'audio/mpeg', 1000, $2) RETURNING id`,
    [`k-${uid()}`, userId],
  );
  return row.id;
}
async function mkTrack(adminId: string): Promise<string> {
  const asset = await mkAsset(adminId);
  const [row] = await sql(
    `INSERT INTO tracks (slug, title, description, duration_sec, audio_asset_id, created_by_id)
     VALUES ($1, 't', 'd', 600, $2, $3) RETURNING id`,
    [`t-${uid()}`, asset, adminId],
  );
  return row.id;
}
async function mkProgram(adminId: string): Promise<string> {
  const [row] = await sql(
    `INSERT INTO programs (slug, title, description, created_by_id) VALUES ($1, 'p', 'd', $2) RETURNING id`,
    [`p-${uid()}`, adminId],
  );
  return row.id;
}
async function mkTrackPrice(trackId: string, interval: 'MONTH' | 'YEAR', active = true): Promise<string> {
  const [row] = await sql(
    `INSERT INTO prices (track_id, interval, stripe_price_id, amount_minor, is_active)
     VALUES ($1, $2, $3, 999, $4) RETURNING id`,
    [trackId, interval, `price_${uid()}`, active],
  );
  return row.id;
}
const subscribe = (userId: string, trackId: string, priceId: string, status = 'ACTIVE') =>
  sql(
    `INSERT INTO subscriptions (user_id, track_id, price_id, stripe_subscription_id, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, trackId, priceId, `sub_${uid()}`, status],
  );

describe('migrations', () => {
  it('create every table from the ERD', async () => {
    const rows = await sql(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    const names = rows.map((r: { table_name: string }) => r.table_name);
    for (const t of [
      'users', 'auth_identities', 'refresh_tokens', 'media_assets', 'elements', 'meridians', 'issues',
      'tracks', 'programs', 'program_tracks', 'track_meridians', 'track_issues', 'prices', 'subscriptions',
      'access_grants', 'invoices', 'stripe_events', 'playback_sessions', 'playback_progress', 'audit_logs',
    ]) {
      expect(names).toContain(t);
    }
  });
});

describe('users', () => {
  it('treats emails case-insensitively', async () => {
    await mkUser('Case@Test.dev');
    await expect(mkUser('case@test.dev')).rejects.toThrow(/unique/i);
  });

  it('does not select password_hash by default', async () => {
    const email = `hash-${uid()}@test.dev`;
    await sql(`INSERT INTO users (email, password_hash) VALUES ($1, 'secret')`, [email]);
    const user = await ds.getRepository(User).findOneByOrFail({ email });
    expect(user.passwordHash).toBeUndefined();
  });
});

describe('exclusive-arc target (track XOR program)', () => {
  it('rejects a price with neither target', async () => {
    await expect(
      sql(`INSERT INTO prices (interval, stripe_price_id, amount_minor) VALUES ('MONTH', $1, 100)`, [`p_${uid()}`]),
    ).rejects.toThrow(/chk_prices_target_xor/);
  });

  it('rejects a price with both targets', async () => {
    const admin = await mkUser();
    const [track, program] = [await mkTrack(admin), await mkProgram(admin)];
    await expect(
      sql(
        `INSERT INTO prices (track_id, program_id, interval, stripe_price_id, amount_minor)
         VALUES ($1, $2, 'MONTH', $3, 100)`,
        [track, program, `p_${uid()}`],
      ),
    ).rejects.toThrow(/chk_prices_target_xor/);
  });
});

describe('prices', () => {
  it('allows one active price per target and interval, but keeps history', async () => {
    const admin = await mkUser();
    const track = await mkTrack(admin);
    await mkTrackPrice(track, 'MONTH');
    await mkTrackPrice(track, 'YEAR'); // other interval is fine
    await expect(mkTrackPrice(track, 'MONTH')).rejects.toThrow(/uq_prices_active_track_interval/);
    await mkTrackPrice(track, 'MONTH', false); // inactive history row is fine
  });
});

describe('subscriptions', () => {
  it('blocks a second live subscription to the same track', async () => {
    const admin = await mkUser();
    const [user, track] = [await mkUser(), await mkTrack(admin)];
    const price = await mkTrackPrice(track, 'MONTH');
    await subscribe(user, track, price);
    await expect(subscribe(user, track, price)).rejects.toThrow(/uq_subscriptions_live_user_track/);
  });

  it('allows resubscribing after the previous one was canceled', async () => {
    const admin = await mkUser();
    const [user, track] = [await mkUser(), await mkTrack(admin)];
    const price = await mkTrackPrice(track, 'MONTH');
    await subscribe(user, track, price, 'CANCELED');
    await expect(subscribe(user, track, price, 'ACTIVE')).resolves.toBeDefined();
  });

  it('lets different users subscribe to the same track', async () => {
    const admin = await mkUser();
    const track = await mkTrack(admin);
    const price = await mkTrackPrice(track, 'MONTH');
    await subscribe(await mkUser(), track, price);
    await expect(subscribe(await mkUser(), track, price)).resolves.toBeDefined();
  });
});

describe('program_tracks ordering', () => {
  it('lets two tracks swap positions inside one transaction', async () => {
    const admin = await mkUser();
    const program = await mkProgram(admin);
    const [a, b] = [await mkTrack(admin), await mkTrack(admin)];
    await sql(`INSERT INTO program_tracks (program_id, track_id, order_index) VALUES ($1,$2,0),($1,$3,1)`, [program, a, b]);

    await ds.transaction(async (em) => {
      await em.query(`UPDATE program_tracks SET order_index = 1 WHERE program_id = $1 AND track_id = $2`, [program, a]);
      await em.query(`UPDATE program_tracks SET order_index = 0 WHERE program_id = $1 AND track_id = $2`, [program, b]);
    });
    const rows = await sql(`SELECT track_id FROM program_tracks WHERE program_id = $1 ORDER BY order_index`, [program]);
    expect(rows.map((r: { track_id: string }) => r.track_id)).toEqual([b, a]);
  });

  it('rejects two tracks with the same position at commit', async () => {
    const admin = await mkUser();
    const program = await mkProgram(admin);
    const [a, b] = [await mkTrack(admin), await mkTrack(admin)];
    await expect(
      sql(`INSERT INTO program_tracks (program_id, track_id, order_index) VALUES ($1,$2,0),($1,$3,0)`, [program, a, b]),
    ).rejects.toThrow(/uq_program_tracks_order/);
  });
});
