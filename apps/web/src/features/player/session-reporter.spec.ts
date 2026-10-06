import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionReporter, type PlaybackApi } from './session-reporter';

const INTERVAL = 15_000;

describe('SessionReporter', () => {
  let clock: number;
  let api: { start: ReturnType<typeof vi.fn>; heartbeat: ReturnType<typeof vi.fn> };
  let reporter: SessionReporter;

  beforeEach(() => {
    clock = 1_000_000;
    api = { start: vi.fn().mockResolvedValue({ sessionId: 's-1', resumeSec: 42 }), heartbeat: vi.fn().mockResolvedValue({ counted: false }) };
    reporter = new SessionReporter(api as unknown as PlaybackApi, () => clock, INTERVAL);
  });

  describe('begin', () => {
    it('starts a session and returns where to resume from', async () => {
      await expect(reporter.begin('t-1')).resolves.toBe(42);
      expect(api.start).toHaveBeenCalledWith({ trackId: 't-1' });
    });

    it('passes the program the track is played from', async () => {
      await reporter.begin('t-1', 'p-1');

      expect(api.start).toHaveBeenCalledWith({ trackId: 't-1', programId: 'p-1' });
    });

    it('starts from the beginning, and reports nothing, when the session cannot be created', async () => {
      api.start.mockRejectedValue(new Error('offline'));

      await expect(reporter.begin('t-1')).resolves.toBe(0);
      reporter.addListening(60);
      await reporter.flush(60);

      expect(api.heartbeat).not.toHaveBeenCalled();
    });

    it('ignores a slow reply for a track the listener has already left', async () => {
      let resolveFirst!: (value: { sessionId: string; resumeSec: number }) => void;
      api.start.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)));
      api.start.mockResolvedValueOnce({ sessionId: 's-2', resumeSec: 0 });

      const first = reporter.begin('t-1');
      await reporter.begin('t-2');
      resolveFirst({ sessionId: 's-1', resumeSec: 99 });

      await expect(first).resolves.toBe(0);
      reporter.addListening(5);
      await reporter.flush(5);
      expect(api.heartbeat).toHaveBeenCalledWith('s-2', expect.anything(), expect.anything());
    });
  });

  describe('heartbeats', () => {
    beforeEach(async () => {
      await reporter.begin('t-1');
    });

    it('waits for the interval before reporting', () => {
      reporter.addListening(5);
      clock += INTERVAL - 1;
      reporter.tick(5);

      expect(api.heartbeat).not.toHaveBeenCalled();
    });

    it('reports once the interval has passed, with whole seconds', () => {
      reporter.addListening(14.6);
      clock += INTERVAL;
      reporter.tick(14.9);

      expect(api.heartbeat).toHaveBeenCalledWith('s-1', { listenedSec: 14, positionSec: 14 }, {});
    });

    it('does not report again until another interval has passed', () => {
      clock += INTERVAL;
      reporter.addListening(15);
      reporter.tick(15);
      reporter.addListening(1);
      reporter.tick(16);

      expect(api.heartbeat).toHaveBeenCalledTimes(1);
    });

    it('counts real listening time, so double speed does not inflate it', () => {
      reporter.addListening(10 / 2); // ten seconds of audio at 2x took five seconds
      void reporter.flush(10);

      expect(api.heartbeat).toHaveBeenCalledWith('s-1', { listenedSec: 5, positionSec: 10 }, {});
    });

    it('ignores zero and negative listening', () => {
      reporter.addListening(0);
      reporter.addListening(-3);
      void reporter.flush(0);

      expect(api.heartbeat).toHaveBeenCalledWith('s-1', { listenedSec: 0, positionSec: 0 }, {});
    });
  });

  describe('flush', () => {
    beforeEach(async () => {
      await reporter.begin('t-1');
    });

    it('sends at once, and can ask the browser to finish the request while the page closes', async () => {
      reporter.addListening(20);

      await reporter.flush(30, { keepalive: true });

      expect(api.heartbeat).toHaveBeenCalledWith('s-1', { listenedSec: 20, positionSec: 30 }, { keepalive: true });
    });

    it('does not repeat a report that says nothing new', async () => {
      reporter.addListening(20);
      await reporter.flush(30);
      await reporter.flush(30);

      expect(api.heartbeat).toHaveBeenCalledTimes(1);
    });

    it('reports again when the position or the listening time moved', async () => {
      await reporter.flush(10);
      await reporter.flush(11);
      reporter.addListening(2);
      await reporter.flush(11);

      expect(api.heartbeat).toHaveBeenCalledTimes(3);
    });

    it('retries after a failed delivery instead of treating it as sent', async () => {
      api.heartbeat.mockRejectedValueOnce(new Error('offline'));

      await expect(reporter.flush(10)).resolves.toBeUndefined(); // a failure never reaches the player
      await reporter.flush(10);

      expect(api.heartbeat).toHaveBeenCalledTimes(2);
    });

    it('does nothing without a session, and nothing after the session ended', async () => {
      const idle = new SessionReporter(api as unknown as PlaybackApi, () => clock, INTERVAL);
      await idle.flush(5);
      reporter.end();
      await reporter.flush(5);

      expect(api.heartbeat).not.toHaveBeenCalled();
    });
  });

  it('starts counting from zero for each new session', async () => {
    await reporter.begin('t-1');
    reporter.addListening(50);
    await reporter.begin('t-2');
    await reporter.flush(0);

    expect(api.heartbeat).toHaveBeenCalledWith('s-1', { listenedSec: 0, positionSec: 0 }, {});
  });
});
