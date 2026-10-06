import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startCatalogApp, type Actor, type CatalogApp } from './helpers/catalog-fixture';

let t: CatalogApp;
let stranger: Actor;

beforeAll(async () => {
  t = await startCatalogApp();
  stranger = await t.signIn('USER');
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

const startSession = (actor: Actor, body: unknown) => t.as(actor).post('/playback/sessions', body);
const heartbeat = (actor: Actor, sessionId: string, body: unknown) => t.as(actor).post(`/playback/sessions/${sessionId}/heartbeat`, body);
const sessionRow = async (id: string) => (await t.ds.query(`SELECT * FROM playback_sessions WHERE id = $1`, [id]))[0];
/** Pretends the session began some time ago, so a long listen is plausible without the test waiting. */
const backdate = (id: string, seconds: number) =>
  t.ds.query(`UPDATE playback_sessions SET started_at = now() - make_interval(secs => $2) WHERE id = $1`, [id, seconds]);

/** A published track the listener owns. `durationMs` defaults to a ten-minute track. */
async function ownedTrack(durationMs?: number) {
  const track = await t.track({ audioAssetId: await t.asset('AUDIO', { durationMs: durationMs ?? 600_000 }) }, { publish: true });
  await t.subscribe(t.listener, { kind: 'TRACK', id: track.id });
  return track;
}

describe('POST /playback/sessions', () => {
  it('starts a session for a track the listener owns', async () => {
    const track = await ownedTrack();

    const res = await startSession(t.listener, { trackId: track.id });

    expect(res.status).toBe(201);
    expect(res.json).toEqual({ sessionId: expect.any(String), resumeSec: 0 });
    expect(await sessionRow(res.json.sessionId)).toMatchObject({
      user_id: t.listener.id,
      track_id: track.id,
      program_id: null,
      listened_sec: 0,
      counted_as_listen: false,
    });
  });

  it('refuses a track the listener does not own, and an anonymous caller', async () => {
    const track = await t.track({}, { publish: true });

    expect((await startSession(t.listener, { trackId: track.id })).status).toBe(403);
    expect((await startSession(t.listener, { trackId: randomUUID() })).status).toBe(403);
    expect((await t.call('/playback/sessions', { body: { trackId: track.id } })).status).toBe(401);
    const [{ count }] = await t.ds.query(`SELECT count(*)::int AS count FROM playback_sessions`);
    expect(count).toBe(0);
  });

  it('records the program a track was played from, only if the listener holds that program', async () => {
    const track = await t.track({}, { publish: true });
    const program = await t.program();
    await t.api.put(`/admin/programs/${program.id}/tracks`, { trackIds: [track.id] });
    await t.subscribe(t.listener, { kind: 'TRACK', id: track.id });

    expect((await startSession(t.listener, { trackId: track.id, programId: program.id })).status).toBe(403);

    await t.subscribe(t.listener, { kind: 'PROGRAM', id: program.id });
    const res = await startSession(t.listener, { trackId: track.id, programId: program.id });
    expect(res.status).toBe(201);
    expect((await sessionRow(res.json.sessionId)).program_id).toBe(program.id);
  });

  it('rejects a malformed request', async () => {
    expect((await startSession(t.listener, {})).status).toBe(400);
    expect((await startSession(t.listener, { trackId: 'nope' })).status).toBe(400);
  });
});

describe('POST /playback/sessions/:id/heartbeat', () => {
  async function started(track: { id: string }) {
    return (await startSession(t.listener, { trackId: track.id })).json.sessionId as string;
  }

  it('counts a listen after 30 seconds, and not a second sooner', async () => {
    const track = await ownedTrack();
    const sessionId = await started(track);
    await backdate(sessionId, 100);

    const before = await heartbeat(t.listener, sessionId, { listenedSec: 29, positionSec: 29 });
    const after = await heartbeat(t.listener, sessionId, { listenedSec: 30, positionSec: 30 });

    expect(before.json).toEqual({ counted: false });
    expect(after.json).toEqual({ counted: true });
    expect(await sessionRow(sessionId)).toMatchObject({ listened_sec: 30, counted_as_listen: true });
  });

  it('counts a short track at half its length', async () => {
    const track = await ownedTrack(40_000);
    const sessionId = await started(track);
    await backdate(sessionId, 100);

    expect((await heartbeat(t.listener, sessionId, { listenedSec: 19, positionSec: 19 })).json.counted).toBe(false);
    expect((await heartbeat(t.listener, sessionId, { listenedSec: 20, positionSec: 20 })).json.counted).toBe(true);
  });

  it('counts a session once, and listening time never goes backwards', async () => {
    const track = await ownedTrack();
    const sessionId = await started(track);
    await backdate(sessionId, 200);
    await heartbeat(t.listener, sessionId, { listenedSec: 60, positionSec: 60 });

    const later = await heartbeat(t.listener, sessionId, { listenedSec: 10, positionSec: 70 });

    expect(later.json.counted).toBe(true);
    expect((await sessionRow(sessionId)).listened_sec).toBe(60);
  });

  it('cannot report more listening than the session has lasted', async () => {
    const track = await ownedTrack();
    const sessionId = await started(track); // a moment ago

    const res = await heartbeat(t.listener, sessionId, { listenedSec: 5000, positionSec: 0 });

    expect(res.json.counted).toBe(false);
    expect((await sessionRow(sessionId)).listened_sec).toBeLessThanOrEqual(6);
  });

  it('lets listening time grow with the real clock', async () => {
    const track = await ownedTrack();
    const sessionId = await started(track);
    await backdate(sessionId, 100);

    await heartbeat(t.listener, sessionId, { listenedSec: 5000, positionSec: 0 });

    const { listened_sec } = await sessionRow(sessionId);
    expect(listened_sec).toBeGreaterThanOrEqual(100);
    expect(listened_sec).toBeLessThanOrEqual(106);
  });

  describe('resume position', () => {
    it('brings the listener back to where they stopped', async () => {
      const track = await ownedTrack();
      const first = await started(track);
      await backdate(first, 300);
      await heartbeat(t.listener, first, { listenedSec: 200, positionSec: 245 });

      const next = await startSession(t.listener, { trackId: track.id });

      expect(next.json.resumeSec).toBe(245);
    });

    it('starts a finished track from the beginning', async () => {
      const track = await ownedTrack(); // 600 s
      const first = await started(track);
      await backdate(first, 700);
      await heartbeat(t.listener, first, { listenedSec: 600, positionSec: 598 });

      expect((await startSession(t.listener, { trackId: track.id })).json.resumeSec).toBe(0);
    });

    it('keeps a position five seconds from the end as resumable, and one second from the end as finished', async () => {
      const track = await ownedTrack();
      const first = await started(track);
      await backdate(first, 700);

      await heartbeat(t.listener, first, { listenedSec: 500, positionSec: 594 });
      expect((await startSession(t.listener, { trackId: track.id })).json.resumeSec).toBe(594);

      await heartbeat(t.listener, first, { listenedSec: 500, positionSec: 595 });
      expect((await startSession(t.listener, { trackId: track.id })).json.resumeSec).toBe(0);
    });

    it('never saves a position beyond the end of the track', async () => {
      const track = await ownedTrack();
      const first = await started(track);

      await heartbeat(t.listener, first, { listenedSec: 0, positionSec: 50_000 });

      const [row] = await t.ds.query(`SELECT position_sec FROM playback_progress WHERE track_id = $1`, [track.id]);
      expect(row.position_sec).toBe(600);
    });

    it('is remembered per listener', async () => {
      const track = await ownedTrack();
      await t.subscribe(stranger, { kind: 'TRACK', id: track.id });
      const mine = await started(track);
      await heartbeat(t.listener, mine, { listenedSec: 0, positionSec: 100 });

      expect((await startSession(stranger, { trackId: track.id })).json.resumeSec).toBe(0);
    });
  });

  describe('who may report', () => {
    it('is a 404 for someone else\'s session and for an unknown one, so ids cannot be probed', async () => {
      const track = await ownedTrack();
      const sessionId = await started(track);

      expect((await heartbeat(stranger, sessionId, { listenedSec: 1, positionSec: 1 })).status).toBe(404);
      expect((await heartbeat(t.listener, randomUUID(), { listenedSec: 1, positionSec: 1 })).status).toBe(404);
      expect((await sessionRow(sessionId)).listened_sec).toBe(0);
    });

    it.each([
      ['a negative time', { listenedSec: -1, positionSec: 0 }],
      ['a fractional time', { listenedSec: 1.5, positionSec: 0 }],
      ['a missing field', { listenedSec: 1 }],
    ])('rejects %s', async (_label, body) => {
      const sessionId = await started(await ownedTrack());

      expect((await heartbeat(t.listener, sessionId, body)).status).toBe(400);
    });

    it('needs a login', async () => {
      expect((await t.call(`/playback/sessions/${randomUUID()}/heartbeat`, { body: { listenedSec: 1, positionSec: 1 } })).status).toBe(401);
    });
  });
});
