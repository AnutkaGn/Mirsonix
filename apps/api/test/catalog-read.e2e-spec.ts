import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startCatalogApp, type CatalogApp } from './helpers/catalog-fixture';

let t: CatalogApp;

beforeAll(async () => {
  t = await startCatalogApp();
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

const ids = (items: { id: string }[]) => items.map((i) => i.id);
const pause = () => new Promise((resolve) => setTimeout(resolve, 15)); // publish dates must differ for ordering tests

describe('authentication', () => {
  it.each(['/catalog/taxonomy', '/catalog/tracks', '/catalog/tracks/x', '/catalog/programs', '/catalog/programs/x'])(
    'keeps %s behind a login: there is no public catalog',
    async (path) => {
      expect((await t.call(path)).status).toBe(401);
    },
  );

  it('is open to a regular listener', async () => {
    expect((await t.asUser.get('/catalog/tracks')).status).toBe(200);
  });
});

describe('GET /catalog/tracks', () => {
  it('shows published tracks only, newest release first', async () => {
    const older = await t.track({ title: 'Older' }, { publish: true });
    await pause();
    const newer = await t.track({ title: 'Newer' }, { publish: true });
    await t.track({ title: 'Hidden draft' });
    const archived = await t.track({ title: 'Gone' }, { publish: true });
    await t.api.post(`/admin/tracks/${archived.id}/archive`);

    const res = await t.asUser.get('/catalog/tracks');

    expect(res.status).toBe(200);
    expect(ids(res.json.items)).toEqual([newer.id, older.id]);
    expect(res.json.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('never reveals where the audio lives', async () => {
    const published = await t.track({}, { publish: true });
    const [{ s3_key }] = await t.ds.query(`SELECT m.s3_key FROM tracks t JOIN media_assets m ON m.id = t.audio_asset_id WHERE t.id = $1`, [published.id]);

    const list = JSON.stringify((await t.asUser.get('/catalog/tracks')).json);
    const detail = JSON.stringify((await t.asUser.get(`/catalog/tracks/${published.slug}`)).json);

    for (const body of [list, detail]) {
      expect(body).not.toContain(s3_key);
      expect(body).not.toContain('audioAssetId');
      expect(body).not.toContain('status');
    }
  });

  it('shows an item with nothing on sale as having no prices, rather than omitting the field', async () => {
    await t.track({}, { publish: true });

    expect((await t.asUser.get('/catalog/tracks')).json.items[0].prices).toEqual({ month: null, year: null });
  });

  it('pages without repeating or skipping a track', async () => {
    const created = [];
    for (let i = 0; i < 5; i++) created.push((await t.track({ title: `Track ${i}` }, { publish: true })).id);

    const pages = [await t.asUser.get('/catalog/tracks?limit=2&page=1'), await t.asUser.get('/catalog/tracks?limit=2&page=2'), await t.asUser.get('/catalog/tracks?limit=2&page=3')];

    expect(pages.map((p) => p.json.items.length)).toEqual([2, 2, 1]);
    expect(pages[0]!.json.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    const seen = pages.flatMap((p) => ids(p.json.items));
    expect(new Set(seen).size).toBe(5);
    expect([...seen].sort()).toEqual([...created].sort());
  });

  it('returns an empty page past the end instead of failing', async () => {
    await t.track({}, { publish: true });

    const res = await t.asUser.get('/catalog/tracks?page=9');

    expect(res.status).toBe(200);
    expect(res.json.items).toEqual([]);
    expect(res.json.meta.total).toBe(1);
  });

  describe('filters', () => {
    let backPain: { id: string };
    let sleep: { id: string };
    let both: { id: string };

    beforeEach(async () => {
      backPain = await t.track(
        { title: 'Spine release', waveType: 'SINE', meridianIds: [await t.meridianId('LU')], issueIds: [await t.issueId('back-pain')] },
        { publish: true },
      );
      sleep = await t.track(
        { title: 'Night tide', waveType: 'BINAURAL', meridianIds: [await t.meridianId('LR')], issueIds: [await t.issueId('sleep')] },
        { publish: true },
      );
      both = await t.track(
        {
          title: 'Kidney reset',
          waveType: 'SINE',
          meridianIds: [await t.meridianId('KI'), await t.meridianId('LU')],
          issueIds: [await t.issueId('back-pain'), await t.issueId('sleep')],
        },
        { publish: true },
      );
    });

    const filtered = async (query: string) => ids((await t.asUser.get(`/catalog/tracks?${query}`)).json.items).sort();

    it.each([
      ['issue', 'issue=back-pain', () => [backPain, both]],
      ['issue', 'issue=sleep', () => [sleep, both]],
      ['meridian', 'meridian=LR', () => [sleep]],
      ['meridian', 'meridian=LU', () => [backPain, both]],
      ['element (Metal contains Lung)', 'element=METAL', () => [backPain, both]],
      ['element (Wood contains Liver)', 'element=WOOD', () => [sleep]],
      ['element (Water contains Kidney)', 'element=WATER', () => [both]],
      ['wave type', 'wave=BINAURAL', () => [sleep]],
      ['title text, any case', 'q=KIDNEY', () => [both]],
      ['several filters together', 'issue=sleep&wave=SINE', () => [both]],
    ])('by %s: %s', async (_label, query, expected) => {
      expect(await filtered(query)).toEqual(ids(expected()).sort());
    });

    it('returns each track once even when it matches through several rows', async () => {
      const res = await t.asUser.get('/catalog/tracks?element=METAL'); // `both` has two meridians, only one in Metal

      expect(res.json.items.filter((i: { id: string }) => i.id === both.id)).toHaveLength(1);
      expect(res.json.meta.total).toBe(2);
    });

    it('finds nothing for an issue or meridian nobody uses', async () => {
      expect(await filtered('issue=does-not-exist')).toEqual([]);
      expect(await filtered('meridian=ZZ')).toEqual([]);
      expect(await filtered('element=FIRE')).toEqual([]);
    });

    it('rejects values that are not part of the vocabulary', async () => {
      expect((await t.asUser.get('/catalog/tracks?wave=SQUARE')).status).toBe(400);
      expect((await t.asUser.get('/catalog/tracks?element=AIR')).status).toBe(400);
      expect((await t.asUser.get('/catalog/tracks?limit=1000')).status).toBe(400);
    });

    it('lists the taxonomy of each track', async () => {
      const item = (await t.asUser.get('/catalog/tracks?q=kidney')).json.items[0];

      expect(item.meridians.map((m: { code: string }) => m.code)).toEqual(['KI', 'LU']);
      expect(item.issues.map((i: { slug: string }) => i.slug)).toEqual(['back-pain', 'sleep']);
    });
  });

  it('treats % and _ in a search as plain characters', async () => {
    const percent = await t.track({ title: 'Rest 100% calm' }, { publish: true });
    await t.track({ title: 'Rest 1000 calm' }, { publish: true });
    const underscore = await t.track({ title: 'snake_case' }, { publish: true });
    await t.track({ title: 'snakeXcase' }, { publish: true });

    expect(ids((await t.asUser.get(`/catalog/tracks?q=${encodeURIComponent('100%')}`)).json.items)).toEqual([percent.id]);
    expect(ids((await t.asUser.get('/catalog/tracks?q=snake_case')).json.items)).toEqual([underscore.id]);
  });

  describe('cover URLs', () => {
    it('are signed when no public base URL is configured', async () => {
      await t.track({}, { publish: true });

      expect((await t.asUser.get('/catalog/tracks')).json.items[0].coverUrl).toMatch(/^https:\/\/fake-s3\.test\/covers\/.+\?signed=1&ttl=3600$/);
    });

    it('come from the public base URL when one is configured', async () => {
      t.storage.publicBaseUrl = 'https://cdn.example.com';
      await t.track({}, { publish: true });

      expect((await t.asUser.get('/catalog/tracks')).json.items[0].coverUrl).toMatch(/^https:\/\/cdn\.example\.com\/covers\/[0-9a-f-]+\.png$/);
    });
  });
});

describe('GET /catalog/tracks/:slug', () => {
  it('returns a published track', async () => {
    const published = await t.track({ title: 'Lung opening', frequencyHz: 432 }, { publish: true });

    const res = await t.asUser.get('/catalog/tracks/lung-opening');

    expect(res.json).toMatchObject({ id: published.id, title: 'Lung opening', frequencyHz: 432, durationSec: 600 });
  });

  it('is a 404 for a draft, an archived track, and an unknown slug', async () => {
    const draft = await t.track({ title: 'Draft one' });
    const archived = await t.track({ title: 'Archived one' }, { publish: true });
    await t.api.post(`/admin/tracks/${archived.id}/archive`);

    for (const slug of [draft.slug, archived.slug, 'nope']) {
      expect((await t.asUser.get(`/catalog/tracks/${slug}`)).status).toBe(404);
    }
  });
});

describe('programs', () => {
  async function publishedProgram(title: string, trackTitles: string[]) {
    const tracks = [];
    for (const trackTitle of trackTitles) tracks.push(await t.track({ title: trackTitle }, { publish: true }));
    const program = await t.program({ title });
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: tracks.map((x) => x.id) });
    await t.api.post(`/admin/programs/${program.id}/publish`);
    return { program, tracks };
  }

  it('lists published programs with their totals and a poster', async () => {
    await publishedProgram('Back recovery', ['Day 1', 'Day 2', 'Day 3']);

    const res = await t.asUser.get('/catalog/programs');

    expect(res.json.items).toEqual([
      expect.objectContaining({ title: 'Back recovery', slug: 'back-recovery', trackCount: 3, totalDurationSec: 1800, posterUrl: expect.stringContaining('covers/') }),
    ]);
    expect(res.json.meta.total).toBe(1);
  });

  it('shows the tracks in the order the admin set', async () => {
    const { tracks } = await publishedProgram('Ordered', ['First', 'Second', 'Third']);
    const program = (await t.api.get('/admin/programs')).json.items[0];
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [tracks[2]!.id, tracks[0]!.id, tracks[1]!.id] });

    const res = await t.asUser.get('/catalog/programs/ordered');

    expect(res.status).toBe(200);
    expect(res.json.tracks.map((x: { title: string }) => x.title)).toEqual(['Third', 'First', 'Second']);
    expect(res.json).toMatchObject({ trackCount: 3, totalDurationSec: 1800 });
  });

  it('never exposes audio keys or status through a program', async () => {
    const { tracks } = await publishedProgram('Safe', ['Only']);
    const [{ s3_key }] = await t.ds.query(`SELECT m.s3_key FROM tracks t JOIN media_assets m ON m.id = t.audio_asset_id WHERE t.id = $1`, [tracks[0]!.id]);

    const body = JSON.stringify((await t.asUser.get('/catalog/programs/safe')).json);

    expect(body).not.toContain(s3_key);
    expect(body).not.toContain('audioAssetId');
  });

  it('hides drafts and archived programs, in the list and by slug', async () => {
    await t.program({ title: 'Draft program' });
    const { program } = await publishedProgram('Soon archived', ['T']);
    await t.api.post(`/admin/programs/${program.id}/archive`);
    await publishedProgram('Visible', ['V']);

    const list = await t.asUser.get('/catalog/programs');

    expect(list.json.items.map((p: { title: string }) => p.title)).toEqual(['Visible']);
    expect((await t.asUser.get('/catalog/programs/draft-program')).status).toBe(404);
    expect((await t.asUser.get('/catalog/programs/soon-archived')).status).toBe(404);
    expect((await t.asUser.get('/catalog/programs/nope')).status).toBe(404);
  });

  it('searches by title', async () => {
    await publishedProgram('Back recovery', ['A']);
    await publishedProgram('Deep sleep', ['B']);

    const res = await t.asUser.get('/catalog/programs?q=sleep');

    expect(res.json.items.map((p: { title: string }) => p.title)).toEqual(['Deep sleep']);
  });
});

describe('GET /catalog/taxonomy', () => {
  it('lists the five elements in the classical order, each with its meridians', async () => {
    const { elements } = (await t.asUser.get('/catalog/taxonomy')).json;

    expect(elements.map((e: { code: string }) => e.code)).toEqual(['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']);
    expect(Object.fromEntries(elements.map((e: { code: string; meridians: unknown[] }) => [e.code, e.meridians.length]))).toEqual({
      WOOD: 2,
      FIRE: 4,
      EARTH: 2,
      METAL: 2,
      WATER: 2,
    });
    expect(elements[3].meridians.map((m: { code: string }) => m.code)).toEqual(['LI', 'LU']);
  });

  it('lists the two vessels separately and the issues alphabetically', async () => {
    const { vessels, issues } = (await t.asUser.get('/catalog/taxonomy')).json;

    expect(vessels.map((v: { code: string }) => v.code)).toEqual(['CV', 'GV']);
    expect(issues).toHaveLength(10);
    const names = issues.map((i: { name: string }) => i.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
