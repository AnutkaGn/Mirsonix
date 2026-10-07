import { UPLOAD_LIMITS, type UploadTicket } from '@mirsonix/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkFile,
  InvalidFileError,
  postToStorage,
  readAudioDurationMs,
  UploadFailedError,
  uploadAsset,
  type UploadDeps,
} from './upload';

const ticket: UploadTicket = {
  assetId: '11111111-1111-4111-8111-111111111111',
  upload: { url: 'https://bucket.s3.test/', fields: { key: 'audio/a.mp3', policy: 'p' } },
  expiresIn: 900,
  maxBytes: 1000,
};
const file = (type: string, size = 100, name = 'a') =>
  new File([new Uint8Array(size)], name, { type });

describe('checkFile', () => {
  it('accepts a supported audio type', () => {
    expect(checkFile('AUDIO', { type: 'audio/mpeg', size: 1 })).toBeNull();
  });

  it('rejects another kind of file for the slot', () => {
    expect(checkFile('AUDIO', { type: 'image/png', size: 1 })).toBe('type');
    expect(checkFile('IMAGE', { type: 'audio/mpeg', size: 1 })).toBe('type');
  });

  it('allows exactly the size limit and refuses one byte more', () => {
    expect(
      checkFile('IMAGE', { type: 'image/png', size: UPLOAD_LIMITS.image.maxBytes }),
    ).toBeNull();
    expect(checkFile('IMAGE', { type: 'image/png', size: UPLOAD_LIMITS.image.maxBytes + 1 })).toBe(
      'size',
    );
  });
});

describe('uploadAsset', () => {
  const deps = {
    createTicket: vi.fn<UploadDeps['createTicket']>(),
    confirm: vi.fn<UploadDeps['confirm']>(),
    post: vi.fn<UploadDeps['post']>(),
    readDuration: vi.fn<UploadDeps['readDuration']>(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    deps.createTicket.mockResolvedValue(ticket);
    deps.post.mockResolvedValue(undefined);
    deps.readDuration.mockResolvedValue(61_000);
    deps.confirm.mockResolvedValue({
      id: ticket.assetId,
      kind: 'AUDIO',
      status: 'READY',
      mimeType: 'audio/mpeg',
      sizeBytes: 1,
      durationMs: 61_000,
    });
  });

  it('uploads audio and confirms it with the measured duration', async () => {
    const audio = file('audio/mpeg', 500);

    const asset = await uploadAsset({ kind: 'AUDIO', file: audio, onProgress: vi.fn() }, deps);

    expect(asset).toMatchObject({ id: ticket.assetId });
    expect(deps.createTicket).toHaveBeenCalledWith({
      kind: 'AUDIO',
      contentType: 'audio/mpeg',
      sizeBytes: 500,
    });
    expect(deps.post).toHaveBeenCalledWith(ticket, audio, expect.any(Function), undefined);
    expect(deps.confirm).toHaveBeenCalledWith(ticket.assetId, { durationMs: 61_000 });
  });

  it('does not measure or send a duration for an image', async () => {
    await uploadAsset({ kind: 'IMAGE', file: file('image/png'), onProgress: vi.fn() }, deps);

    expect(deps.readDuration).not.toHaveBeenCalled();
    expect(deps.confirm).toHaveBeenCalledWith(ticket.assetId, {});
  });

  it('stops before asking the server when the file is not allowed', async () => {
    await expect(
      uploadAsset({ kind: 'AUDIO', file: file('text/plain'), onProgress: vi.fn() }, deps),
    ).rejects.toBeInstanceOf(InvalidFileError);
    expect(deps.createTicket).not.toHaveBeenCalled();
  });

  it('does not confirm when the transfer to storage fails', async () => {
    deps.post.mockRejectedValue(new UploadFailedError(403));

    await expect(
      uploadAsset({ kind: 'IMAGE', file: file('image/png'), onProgress: vi.fn() }, deps),
    ).rejects.toBeInstanceOf(UploadFailedError);
    expect(deps.confirm).not.toHaveBeenCalled();
  });
});

describe('postToStorage', () => {
  class FakeXhr {
    static last: FakeXhr;
    status = 0;
    upload: {
      onprogress:
        ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
    } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    open = vi.fn();
    send = vi.fn((body: FormData) => {
      this.body = body;
    });
    abort = vi.fn(() => this.onabort?.());
    body: FormData | null = null;
    constructor() {
      FakeXhr.last = this;
    }
  }

  beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXhr));
  afterEach(() => vi.unstubAllGlobals());

  it('posts the signed fields first and the file last, and reports progress', async () => {
    const onProgress = vi.fn();
    const promise = postToStorage(ticket, file('audio/mpeg'), onProgress);
    const xhr = FakeXhr.last;

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    xhr.status = 204;
    xhr.onload?.();

    await expect(promise).resolves.toBeUndefined();
    expect(xhr.open).toHaveBeenCalledWith('POST', ticket.upload.url);
    expect([...(xhr.body?.keys() ?? [])]).toEqual(['key', 'policy', 'file']);
    expect(onProgress).toHaveBeenCalledWith(0.25);
  });

  it('ignores progress events without a known total', async () => {
    const onProgress = vi.fn();
    void postToStorage(ticket, file('audio/mpeg'), onProgress);

    FakeXhr.last.upload.onprogress?.({ lengthComputable: false, loaded: 1, total: 0 });

    expect(onProgress).not.toHaveBeenCalled();
  });

  it('fails with the storage status on a rejection', async () => {
    const promise = postToStorage(ticket, file('audio/mpeg'), vi.fn());
    FakeXhr.last.status = 403;
    FakeXhr.last.onload?.();

    await expect(promise).rejects.toMatchObject({ status: 403 });
  });

  it('fails with status 0 when storage cannot be reached', async () => {
    const promise = postToStorage(ticket, file('audio/mpeg'), vi.fn());
    FakeXhr.last.onerror?.();

    await expect(promise).rejects.toMatchObject({ status: 0 });
  });

  it('aborts when cancelled', async () => {
    const controller = new AbortController();
    const promise = postToStorage(ticket, file('audio/mpeg'), vi.fn(), controller.signal);

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('readAudioDurationMs', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  const fakeAudio = () => ({
    preload: '',
    src: '',
    duration: 0,
    onloadedmetadata: null as null | (() => void),
    onerror: null as null | (() => void),
  });

  it('rounds the metadata length to milliseconds and frees the object URL', async () => {
    const audio = fakeAudio();
    const promise = readAudioDurationMs(
      file('audio/mpeg'),
      () => audio as unknown as HTMLAudioElement,
    );

    audio.duration = 12.3456;
    audio.onloadedmetadata?.();

    await expect(promise).resolves.toBe(12_346);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it.each([[Infinity], [0], [NaN]])('rejects a length of %s', async (duration) => {
    const audio = fakeAudio();
    const promise = readAudioDurationMs(
      file('audio/mpeg'),
      () => audio as unknown as HTMLAudioElement,
    );

    audio.duration = duration;
    audio.onloadedmetadata?.();

    await expect(promise).rejects.toThrow('Unreadable audio length');
  });

  it('rejects a file the browser cannot decode', async () => {
    const audio = fakeAudio();
    const promise = readAudioDurationMs(
      file('audio/mpeg'),
      () => audio as unknown as HTMLAudioElement,
    );

    audio.onerror?.();

    await expect(promise).rejects.toThrow('Unreadable audio file');
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
