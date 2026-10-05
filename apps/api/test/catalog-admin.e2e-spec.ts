import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startCatalogApp, type CatalogApp } from './helpers/catalog-fixture';

let t: CatalogApp;

beforeAll(async () => {
  t = await startCatalogApp();
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

const trackCount = async () => (await t.ds.query(`SELECT count(*)::int AS count FROM tracks`))[0].count as number;

describe('POST /admin/tracks', () => {
  it('creates a draft with a slug, a duration taken from the audio, and its taxonomy', async () => {
    const res = await t.api.post('/admin/tracks', {
      title: 'Lung  opening',
      description: 'Slow breathing for the Lung meridian.',
      audioAssetId: await t.asset('AUDIO', { durationMs: 61_400 }),
      coverAssetId: await t.asset('IMAGE'),
      frequencyHz: 432,
      waveType: 'SINE',
      meridianIds: [await t.meridianId('LU')],
      issueIds: [await t.issueId('stress-anxiety'), await t.issueId('sleep')],
    });

    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      slug: 'lung-opening',
      status: 'DRAFT',
      durationSec: 61,
      frequencyHz: 432,
      waveType: 'SINE',
      publishedAt: null,
      meridians: [{ code: 'LU', name: 'Lung' }],
      issues: [{ name: 'Sleep' }, { name: 'Stress and anxiety' }],
    });
    expect(res.json.coverUrl).toContain('signed=1');
  });

  it('keeps slugs unique when two titles collide', async () => {
    const first = await t.track({ title: 'Deep Sleep' });
    const second = await t.track({ title: 'Deep Sleep' });

    expect([first.slug, second.slug]).toEqual(['deep-sleep', 'deep-sleep-2']);
  });

  it('can be created with the minimum: a title, a description and audio', async () => {
    const res = await t.api.post('/admin/tracks', {
      title: 'Bare',
      description: 'Just audio.',
      audioAssetId: await t.asset('AUDIO'),
    });

    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ coverUrl: null, coverAssetId: null, frequencyHz: null, waveType: null, meridians: [], issues: [] });
  });

  it.each([
    ['audio that has not finished uploading', async () => ({ audioAssetId: await t.asset('AUDIO', { status: 'PENDING' }) })],
    ['audio that failed to upload', async () => ({ audioAssetId: await t.asset('AUDIO', { status: 'FAILED' }) })],
    ['an image used as audio', async () => ({ audioAssetId: await t.asset('IMAGE') })],
    ['audio used as a cover', async () => ({ coverAssetId: await t.asset('AUDIO') })],
    ['audio with no duration', async () => ({ audioAssetId: await t.asset('AUDIO', { durationMs: null }) })],
    ['an asset that does not exist', async () => ({ audioAssetId: randomUUID() })],
    ['an unknown meridian', async () => ({ meridianIds: [randomUUID()] })],
    ['an unknown issue', async () => ({ issueIds: [randomUUID()] })],
  ])('rejects %s and creates nothing', async (_label, overrides) => {
    const res = await t.api.post('/admin/tracks', {
      title: 'Bad',
      description: 'x',
      audioAssetId: await t.asset('AUDIO'),
      ...(await overrides()),
    });

    expect(res.status).toBe(422);
    expect(await trackCount()).toBe(0);
  });

  it.each([
    ['a missing title', { description: 'x' }],
    ['a blank title', { title: '   ', description: 'x' }],
    ['a repeated meridian', { title: 't', description: 'x', meridianIds: [randomUUID(), randomUUID()].map((_, i, a) => a[0]) }],
    ['a malformed asset id', { title: 't', description: 'x', audioAssetId: 'nope' }],
    ['a non-positive frequency', { title: 't', description: 'x', frequencyHz: 0 }],
  ])('answers 400 for %s', async (_label, body) => {
    const res = await t.api.post('/admin/tracks', { audioAssetId: await t.asset('AUDIO'), ...body });

    expect(res.status).toBe(400);
  });

  it('writes an audit entry naming the admin', async () => {
    const created = await t.track({ title: 'Audited' });

    const logs = await t.ds.query(`SELECT admin_id, metadata FROM audit_logs WHERE action = 'track.create' AND entity_id = $1`, [created.id]);
    expect(logs).toEqual([{ admin_id: t.admin.id, metadata: { title: 'Audited' } }]);
  });
});

describe('PATCH /admin/tracks/:id', () => {
  it('changes only the fields that were sent, and keeps the slug and taxonomy', async () => {
    const created = await t.track({
      title: 'Original',
      meridianIds: [await t.meridianId('LU')],
      issueIds: [await t.issueId('sleep')],
    });

    const res = await t.api.patch(`/admin/tracks/${created.id}`, { title: 'Renamed', frequencyHz: 528 });

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      slug: 'original',
      title: 'Renamed',
      frequencyHz: 528,
      meridians: [{ code: 'LU' }],
      issues: [{ slug: 'sleep' }],
      description: created.description,
    });
  });

  it('replaces the taxonomy when a list is sent, and clears it for an empty list', async () => {
    const created = await t.track({ meridianIds: [await t.meridianId('LU')], issueIds: [await t.issueId('sleep')] });

    const swapped = await t.api.patch(`/admin/tracks/${created.id}`, { meridianIds: [await t.meridianId('LR'), await t.meridianId('GB')] });
    expect(swapped.json.meridians.map((m: { code: string }) => m.code)).toEqual(['GB', 'LR']);
    expect(swapped.json.issues).toHaveLength(1); // untouched

    const cleared = await t.api.patch(`/admin/tracks/${created.id}`, { issueIds: [] });
    expect(cleared.json.issues).toEqual([]);
  });

  it('recomputes the duration when the audio is replaced', async () => {
    const created = await t.track();
    const longer = await t.asset('AUDIO', { durationMs: 1_800_000 });

    const res = await t.api.patch(`/admin/tracks/${created.id}`, { audioAssetId: longer });

    expect(res.json).toMatchObject({ audioAssetId: longer, durationSec: 1800 });
  });

  it('moves the updated timestamp even when only the taxonomy changed', async () => {
    const created = await t.track();
    await new Promise((resolve) => setTimeout(resolve, 15));

    const res = await t.api.patch(`/admin/tracks/${created.id}`, { issueIds: [await t.issueId('sleep')] });

    expect(new Date(res.json.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());
  });

  it('rejects an invalid reference without half-applying the change', async () => {
    const created = await t.track({ title: 'Stable' });

    const res = await t.api.patch(`/admin/tracks/${created.id}`, { title: 'Changed', meridianIds: [randomUUID()] });

    expect(res.status).toBe(422);
    expect((await t.api.get(`/admin/tracks/${created.id}`)).json.title).toBe('Stable');
  });

  it('is a 404 for an unknown track', async () => {
    expect((await t.api.patch(`/admin/tracks/${randomUUID()}`, { title: 'x' })).status).toBe(404);
  });
});

describe('track publishing', () => {
  it('needs a cover before it can be published', async () => {
    const bare = await t.api.post('/admin/tracks', { title: 'No cover', description: 'x', audioAssetId: await t.asset('AUDIO') });

    const res = await t.api.post(`/admin/tracks/${bare.json.id}/publish`);

    expect(res.status).toBe(422);
    expect((await t.api.get(`/admin/tracks/${bare.json.id}`)).json.status).toBe('DRAFT');
  });

  it('publishes, stamps the first publish date, and audits it', async () => {
    const created = await t.track();

    const res = await t.api.post(`/admin/tracks/${created.id}/publish`);

    expect(res.status).toBe(200);
    expect(res.json.status).toBe('PUBLISHED');
    expect(res.json.publishedAt).toBeTruthy();
    const [{ count }] = await t.ds.query(`SELECT count(*)::int AS count FROM audit_logs WHERE action = 'track.publish' AND entity_id = $1`, [created.id]);
    expect(count).toBe(1);
  });

  it('cannot be published twice', async () => {
    const published = await t.track({}, { publish: true });

    expect((await t.api.post(`/admin/tracks/${published.id}/publish`)).status).toBe(409);
  });

  it('keeps its cover once published', async () => {
    const published = await t.track({}, { publish: true });

    const res = await t.api.patch(`/admin/tracks/${published.id}`, { coverAssetId: null });

    expect(res.status).toBe(422);
    expect((await t.api.get(`/admin/tracks/${published.id}`)).json.coverAssetId).toBe(published.coverAssetId);
  });

  it('can be archived and published again, keeping its original publish date', async () => {
    const published = await t.track({}, { publish: true });

    const archived = await t.api.post(`/admin/tracks/${published.id}/archive`);
    expect(archived.json.status).toBe('ARCHIVED');

    const again = await t.api.post(`/admin/tracks/${published.id}/publish`);
    expect(again.json).toMatchObject({ status: 'PUBLISHED', publishedAt: published.publishedAt });
  });

  it('cannot be archived while a published program contains it', async () => {
    const inProgram = await t.track({}, { publish: true });
    const program = await t.program({ title: 'Back recovery' });
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [inProgram.id] });
    await t.api.post(`/admin/programs/${program.id}/publish`);

    const blocked = await t.api.post(`/admin/tracks/${inProgram.id}/archive`);
    expect(blocked.status).toBe(409);
    expect(blocked.json.message).toContain('Back recovery');

    await t.api.post(`/admin/programs/${program.id}/archive`); // once the program is archived the track is free
    expect((await t.api.post(`/admin/tracks/${inProgram.id}/archive`)).status).toBe(200);
  });
});

describe('GET /admin/tracks', () => {
  it('lists every status, newest edit first, and filters by status and title', async () => {
    const draft = await t.track({ title: 'Alpha draft' });
    const published = await t.track({ title: 'Beta live' }, { publish: true });

    const all = await t.api.get('/admin/tracks');
    expect(all.json.meta).toMatchObject({ total: 2, page: 1 });
    expect(all.json.items.map((i: { id: string }) => i.id)).toEqual([published.id, draft.id]);

    const onlyDrafts = await t.api.get('/admin/tracks?status=DRAFT');
    expect(onlyDrafts.json.items.map((i: { id: string }) => i.id)).toEqual([draft.id]);

    const byTitle = await t.api.get('/admin/tracks?q=beta');
    expect(byTitle.json.items.map((i: { id: string }) => i.id)).toEqual([published.id]);
  });

  it('returns one track and a 404 for an unknown id', async () => {
    const created = await t.track();

    expect((await t.api.get(`/admin/tracks/${created.id}`)).json.id).toBe(created.id);
    expect((await t.api.get(`/admin/tracks/${randomUUID()}`)).status).toBe(404);
  });
});

describe('GET /admin/tracks/:id/audio-preview', () => {
  it('returns a short-lived signed URL for the track audio', async () => {
    const created = await t.track();
    const [{ s3_key }] = await t.ds.query(`SELECT m.s3_key FROM tracks t JOIN media_assets m ON m.id = t.audio_asset_id WHERE t.id = $1`, [created.id]);

    const res = await t.api.get(`/admin/tracks/${created.id}/audio-preview`);

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ url: `https://fake-s3.test/${s3_key}?signed=1&ttl=600`, expiresIn: 600 });
  });
});

describe('admin access control', () => {
  it.each([
    ['GET', '/admin/tracks'],
    ['POST', '/admin/tracks'],
    ['GET', '/admin/programs'],
    ['POST', '/admin/programs'],
  ])('keeps listeners and anonymous visitors out of %s %s', async (method, path) => {
    expect((await t.call(path, { method, token: t.listener.token, body: method === 'POST' ? {} : undefined })).status).toBe(403);
    expect((await t.call(path, { method, body: method === 'POST' ? {} : undefined })).status).toBe(401);
  });
});

describe('programs', () => {
  it('builds an ordered list and reports totals', async () => {
    const [a, b, c] = [await t.track({}, { publish: true }), await t.track({}, { publish: true }), await t.track({}, { publish: true })];
    const program = await t.program();

    const res = await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [a.id, b.id, c.id] });

    expect(res.status).toBe(200);
    expect(res.json.tracks.map((x: { id: string }) => x.id)).toEqual([a.id, b.id, c.id]);
    expect(res.json).toMatchObject({ trackCount: 3, totalDurationSec: 1800, status: 'DRAFT' });
  });

  it('reorders by swapping positions in one request', async () => {
    const [a, b] = [await t.track(), await t.track()];
    const program = await t.program();
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [a.id, b.id] });

    const swapped = await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [b.id, a.id] });

    expect(swapped.json.tracks.map((x: { id: string }) => x.id)).toEqual([b.id, a.id]);
    const rows = await t.ds.query(`SELECT track_id, order_index FROM program_tracks WHERE program_id = $1 ORDER BY order_index`, [program.id]);
    expect(rows).toEqual([{ track_id: b.id, order_index: 0 }, { track_id: a.id, order_index: 1 }]);
  });

  it('removes a track by leaving it out, and empties the program with an empty list', async () => {
    const [a, b] = [await t.track(), await t.track()];
    const program = await t.program();
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [a.id, b.id] });

    const one = await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [b.id] });
    expect(one.json.tracks.map((x: { id: string }) => x.id)).toEqual([b.id]);

    const none = await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [] });
    expect(none.json).toMatchObject({ tracks: [], trackCount: 0, totalDurationSec: 0 });
  });

  it('rejects an unknown track and a track listed twice, leaving the list as it was', async () => {
    const a = await t.track();
    const program = await t.program();
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [a.id] });

    expect((await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [a.id, randomUUID()] })).status).toBe(422);
    expect((await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [a.id, a.id] })).status).toBe(400);
    expect((await t.api.get(`/admin/programs/${program.id}`)).json.tracks).toHaveLength(1);
  });

  it('lets the same track sit in several programs', async () => {
    const a = await t.track();
    const [p1, p2] = [await t.program(), await t.program()];

    expect((await t.api.put(`/admin/programs/${p1.id}/tracks`, { trackIds: [a.id] })).status).toBe(200);
    expect((await t.api.put(`/admin/programs/${p2.id}/tracks`, { trackIds: [a.id] })).status).toBe(200);
  });

  it('generates a unique slug and accepts a program without a poster', async () => {
    const first = await t.api.post('/admin/programs', { title: 'Back Recovery', description: 'x' });
    const second = await t.api.post('/admin/programs', { title: 'Back Recovery', description: 'x' });

    expect([first.json.slug, second.json.slug]).toEqual(['back-recovery', 'back-recovery-2']);
    expect(first.json.posterUrl).toBeNull();
  });

  it('updates only what was sent', async () => {
    const program = await t.program({ title: 'Before' });

    const res = await t.api.patch(`/admin/programs/${program.id}`, { description: 'After' });

    expect(res.json).toMatchObject({ title: 'Before', description: 'After', slug: program.slug });
  });

  describe('publishing', () => {
    it('needs a poster', async () => {
      const [a, program] = [await t.track({}, { publish: true }), await t.api.post('/admin/programs', { title: 'No poster', description: 'x' })];
      await t.api.put(`/admin/programs/${program.json.id}/tracks`, { trackIds: [a.id] });

      expect((await t.api.post(`/admin/programs/${program.json.id}/publish`)).status).toBe(422);
    });

    it('needs at least one track', async () => {
      const program = await t.program();

      expect((await t.api.post(`/admin/programs/${program.id}/publish`)).status).toBe(422);
    });

    it('needs every track to be published, and names the ones that are not', async () => {
      const [live, draft] = [await t.track({}, { publish: true }), await t.track({ title: 'Still a draft' })];
      const program = await t.program();
      await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [live.id, draft.id] });

      const res = await t.api.post(`/admin/programs/${program.id}/publish`);

      expect(res.status).toBe(422);
      expect(res.json.message).toContain('Still a draft');
    });

    it('publishes when everything is in place, once', async () => {
      const [a, program] = [await t.track({}, { publish: true }), await t.program()];
      await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [a.id] });

      const res = await t.api.post(`/admin/programs/${program.id}/publish`);
      expect(res.json).toMatchObject({ status: 'PUBLISHED', publishedAt: expect.any(String) });
      expect((await t.api.post(`/admin/programs/${program.id}/publish`)).status).toBe(409);
    });

    it('keeps a published program valid: published tracks only, never empty, always with a poster', async () => {
      const [live, draft] = [await t.track({}, { publish: true }), await t.track()];
      const program = await t.program();
      await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [live.id] });
      await t.api.post(`/admin/programs/${program.id}/publish`);

      expect((await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [live.id, draft.id] })).status).toBe(422);
      expect((await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [] })).status).toBe(422);
      expect((await t.api.patch(`/admin/programs/${program.id}`, { posterAssetId: null })).status).toBe(422);
      expect((await t.api.get(`/admin/programs/${program.id}`)).json.trackCount).toBe(1);
    });
  });

  it('cannot be edited once archived', async () => {
    const [a, program] = [await t.track(), await t.program()];
    await t.api.post(`/admin/programs/${program.id}/archive`);

    expect((await t.api.patch(`/admin/programs/${program.id}`, { title: 'x' })).status).toBe(409);
    expect((await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [a.id] })).status).toBe(409);
  });

  it('lists programs with their totals, filtered by status', async () => {
    const [a, b] = [await t.track(), await t.track()];
    const [full, empty] = [await t.program({ title: 'Full' }), await t.program({ title: 'Empty' })];
    await t.api.put(`/admin/programs/${full.id}/tracks`, { trackIds: [a.id, b.id] });

    const all = await t.api.get('/admin/programs');
    const byTitle = Object.fromEntries(all.json.items.map((p: { title: string; trackCount: number; totalDurationSec: number }) => [p.title, p]));
    expect(byTitle.Full).toMatchObject({ trackCount: 2, totalDurationSec: 1200 });
    expect(byTitle.Empty).toMatchObject({ trackCount: 0, totalDurationSec: 0 });

    await t.api.post(`/admin/programs/${empty.id}/archive`);
    expect((await t.api.get('/admin/programs?status=ARCHIVED')).json.items.map((p: { id: string }) => p.id)).toEqual([empty.id]);
  });

  it('writes audit entries for the builder', async () => {
    const [a, program] = [await t.track(), await t.program()];
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [a.id] });

    const rows = await t.ds.query(`SELECT action, metadata FROM audit_logs WHERE entity_id = $1 ORDER BY created_at`, [program.id]);
    expect(rows.map((r: { action: string }) => r.action)).toEqual(['program.create', 'program.set-tracks']);
    expect(rows[1].metadata).toEqual({ trackIds: [a.id] });
  });
});
