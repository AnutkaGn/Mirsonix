import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startCatalogApp, type CatalogApp } from './helpers/catalog-fixture';

let t: CatalogApp;

beforeAll(async () => {
  t = await startCatalogApp();
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

const audioRequest = { kind: 'AUDIO', contentType: 'audio/mpeg', sizeBytes: 5_000_000 };

describe('POST /admin/media/uploads', () => {
  it('issues a presigned ticket and records a pending asset under the private prefix', async () => {
    const res = await t.api.post('/admin/media/uploads', audioRequest);

    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ expiresIn: 900, upload: { url: expect.stringContaining('test-bucket') } });
    expect(res.json.upload.fields.key).toMatch(/^audio\/[0-9a-f-]{36}\.mp3$/);

    const [row] = await t.ds.query(`SELECT status, bucket, uploaded_by_id, size_bytes FROM media_assets WHERE id = $1`, [res.json.assetId]);
    expect(row).toMatchObject({ status: 'PENDING', bucket: 'test-bucket', uploaded_by_id: t.admin.id });
    expect(Number(row.size_bytes)).toBe(5_000_000);
  });

  it('puts an image under the cover prefix', async () => {
    const res = await t.api.post('/admin/media/uploads', { kind: 'IMAGE', contentType: 'image/webp', sizeBytes: 90_000 });

    expect(res.json.upload.fields.key).toMatch(/^covers\/.+\.webp$/);
  });

  it('is closed to listeners and anonymous visitors', async () => {
    expect((await t.asUser.post('/admin/media/uploads', audioRequest)).status).toBe(403);
    expect((await t.call('/admin/media/uploads', { body: audioRequest })).status).toBe(401);
  });

  it.each([
    ['an unsupported type', { ...audioRequest, contentType: 'application/zip' }, 'contentType'],
    ['an oversized file', { ...audioRequest, sizeBytes: 10 * 1024 * 1024 * 1024 }, 'sizeBytes'],
    ['a type that does not match the kind', { ...audioRequest, kind: 'IMAGE' }, 'contentType'],
  ])('rejects %s', async (_label, body, field) => {
    const res = await t.api.post('/admin/media/uploads', body);

    expect(res.status).toBe(400);
    expect(res.json.details.map((d: { path: string }) => d.path)).toContain(field);
  });

  it('is unavailable, and records nothing, while storage is not configured', async () => {
    t.storage.configured = false;

    expect((await t.api.post('/admin/media/uploads', audioRequest)).status).toBe(503);
    const [{ count }] = await t.ds.query(`SELECT count(*)::int AS count FROM media_assets`);
    expect(count).toBe(0);
  });
});

describe('POST /admin/media/uploads/:id/confirm', () => {
  async function ticket(request = audioRequest) {
    return (await t.api.post('/admin/media/uploads', request)).json;
  }

  it('marks the asset ready once the file is in storage, and writes an audit entry', async () => {
    const { assetId, upload } = await ticket();
    t.storage.simulateUpload(upload.fields.key, 5_000_000, 'audio/mpeg');

    const res = await t.api.post(`/admin/media/uploads/${assetId}/confirm`, { durationMs: 612_500 });

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ id: assetId, kind: 'AUDIO', status: 'READY', durationMs: 612_500, sizeBytes: 5_000_000 });
    expect(Object.keys(res.json).sort()).toEqual(['durationMs', 'id', 'kind', 'mimeType', 'sizeBytes', 'status']);
    expect(JSON.stringify(res.json)).not.toContain(upload.fields.key); // the storage key never leaves the server
    const logs = await t.ds.query(`SELECT admin_id FROM audit_logs WHERE action = 'media.confirm' AND entity_id = $1`, [assetId]);
    expect(logs).toEqual([{ admin_id: t.admin.id }]);
  });

  it('can be repeated without side effects', async () => {
    const { assetId, upload } = await ticket();
    t.storage.simulateUpload(upload.fields.key, 5_000_000, 'audio/mpeg');
    await t.api.post(`/admin/media/uploads/${assetId}/confirm`, { durationMs: 1000 });

    const again = await t.api.post(`/admin/media/uploads/${assetId}/confirm`, { durationMs: 9999 });

    expect(again.status).toBe(200);
    expect(again.json.durationMs).toBe(1000);
    const [{ count }] = await t.ds.query(`SELECT count(*)::int AS count FROM audit_logs WHERE action = 'media.confirm'`);
    expect(count).toBe(1);
  });

  it('asks the admin to wait when nothing has been uploaded yet, and allows a retry', async () => {
    const { assetId, upload } = await ticket();

    expect((await t.api.post(`/admin/media/uploads/${assetId}/confirm`, { durationMs: 1000 })).status).toBe(409);

    t.storage.simulateUpload(upload.fields.key, 5_000_000, 'audio/mpeg');
    expect((await t.api.post(`/admin/media/uploads/${assetId}/confirm`, { durationMs: 1000 })).status).toBe(200);
  });

  it('needs the duration of an audio file', async () => {
    const { assetId, upload } = await ticket();
    t.storage.simulateUpload(upload.fields.key, 5_000_000, 'audio/mpeg');

    expect((await t.api.post(`/admin/media/uploads/${assetId}/confirm`, {})).status).toBe(422);
  });

  it('fails the asset for good when the stored file is not what was announced', async () => {
    const { assetId, upload } = await ticket();
    t.storage.simulateUpload(upload.fields.key, 4_999_999, 'audio/mpeg');

    expect((await t.api.post(`/admin/media/uploads/${assetId}/confirm`, { durationMs: 1000 })).status).toBe(422);
    const [{ status }] = await t.ds.query(`SELECT status FROM media_assets WHERE id = $1`, [assetId]);
    expect(status).toBe('FAILED');
    expect((await t.api.post(`/admin/media/uploads/${assetId}/confirm`, { durationMs: 1000 })).status).toBe(409);
  });

  it('confirms an image without a duration', async () => {
    const { assetId, upload } = await ticket({ kind: 'IMAGE', contentType: 'image/png', sizeBytes: 2000 } as typeof audioRequest);
    t.storage.simulateUpload(upload.fields.key, 2000, 'image/png');

    const res = await t.api.post(`/admin/media/uploads/${assetId}/confirm`, {});

    expect(res.json).toMatchObject({ status: 'READY', durationMs: null });
  });

  it('is a 404 for an unknown asset and a 400 for a malformed id', async () => {
    expect((await t.api.post('/admin/media/uploads/00000000-0000-4000-8000-000000000000/confirm', { durationMs: 1 })).status).toBe(404);
    expect((await t.api.post('/admin/media/uploads/not-a-uuid/confirm', { durationMs: 1 })).status).toBe(400);
  });

  it('is closed to listeners', async () => {
    const { assetId } = await ticket();

    expect((await t.asUser.post(`/admin/media/uploads/${assetId}/confirm`, { durationMs: 1 })).status).toBe(403);
  });
});
