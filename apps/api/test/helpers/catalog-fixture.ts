import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { seedReferenceData } from '../../src/database/seeds/reference-seed';
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
  const app: TestApp = await createTestApp({}, (builder, tokens) => builder.overrideProvider(tokens.StoragePort).useValue(storage));
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

  /** Empties the catalog tables so every test starts from a clean slate (users and taxonomy are kept). */
  async function reset(): Promise<void> {
    await ds.query(`TRUNCATE tracks, programs, media_assets, audit_logs CASCADE`);
    storage.reset();
  }

  return {
    ds,
    app,
    call,
    storage,
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
